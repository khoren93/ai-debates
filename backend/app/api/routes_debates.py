import contextlib
import logging
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.db import get_db
from app.core.ratelimit import enforce_debate_create_limit
from app.core.redis import get_async_redis, provider_key_key, stop_flag_key
from app.models.models import Debate, DebateParticipant, Turn, utcnow
from app.schemas.schemas import (
    DebateConfig,
    DebateDetail,
    DebateResponse,
    DebateSettingsOut,
    DebateSummary,
    DebateTotals,
    ParticipantOut,
    StopDebateResponse,
    TurnOut,
    TurnUsage,
)
from app.services.events import publish_event_async
from app.services.media.languages import language_code
from app.services.media.paths import MediaPaths
from app.services.queue_manager import enqueue_debate_start
from app.services.scheduler import speaker_role_for

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_uuid(debate_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(debate_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid debate id") from e


def _totals(debate: Debate) -> DebateTotals:
    return DebateTotals.model_validate(debate.totals_json or {})


def _turn_out(turn: Turn) -> TurnOut:
    return TurnOut(
        seq_index=turn.seq_index,
        round_id=turn.round_id,
        turn_type=turn.turn_type,
        speaker_role=speaker_role_for(turn.turn_type),  # type: ignore[arg-type]
        speaker_id=turn.speaker_id,
        speaker_name=turn.speaker_name,
        text=turn.text,
        error=turn.error,
        model_used=turn.model_used,
        usage=TurnUsage.model_validate(turn.usage_json or {}),
        created_at=turn.created_at,
    )


@router.get("", response_model=list[DebateSummary])
async def list_debates(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[DebateSummary]:
    """List debates, newest first."""
    stmt = select(Debate).order_by(Debate.created_at.desc()).limit(limit).offset(offset)
    debates = (await db.execute(stmt)).scalars().all()
    return [
        DebateSummary(
            id=str(d.id),
            title=d.title,
            status=d.status,
            media_status=d.media_status or "none",
            created_at=d.created_at,
            totals=_totals(d),
        )
        for d in debates
    ]


@router.post(
    "",
    response_model=DebateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_debate_create_limit)],
)
async def create_debate(config: DebateConfig, db: AsyncSession = Depends(get_db)) -> DebateResponse:
    """Create a debate and enqueue it for the worker."""
    provider_key = config.user_provider_key
    debate = Debate(
        title=f"Debate: {config.topic}",
        # The user's API key is deliberately kept out of the database.
        config_json=config.model_dump(exclude={"user_provider_key"}),
        status="queued",
    )
    db.add(debate)
    await db.flush()

    for p in config.participants:
        db.add(
            DebateParticipant(
                debate_id=debate.id,
                role=p.role,
                model_id=p.model_id,
                persona_name=p.display_name,
                voice_name=p.voice_name,
                avatar_url=p.avatar_url,
            )
        )
    await db.commit()
    debate_id = str(debate.id)

    try:
        if provider_key:
            await get_async_redis().set(
                provider_key_key(debate_id), provider_key, ex=settings.PROVIDER_KEY_TTL
            )
        await run_in_threadpool(enqueue_debate_start, debate_id)
    except RedisError:
        logger.exception("Failed to enqueue debate %s", debate_id)
        debate.status = "error"
        debate.error_message = "Job queue unavailable"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Job queue is unavailable, please try again later",
        ) from None

    return DebateResponse(debate_id=debate_id, status="queued", message="Debate created and queued")


@router.get("/{debate_id}", response_model=DebateDetail)
async def get_debate(debate_id: str, db: AsyncSession = Depends(get_db)) -> DebateDetail:
    """Debate details including participants and all turns."""
    uuid_id = _parse_uuid(debate_id)
    stmt = (
        select(Debate)
        .options(selectinload(Debate.turns), selectinload(Debate.participants))
        .where(Debate.id == uuid_id)
    )
    debate = (await db.execute(stmt)).scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")

    conf = debate.config_json or {}
    return DebateDetail(
        id=str(debate.id),
        status=debate.status,
        media_status=debate.media_status or "none",
        title=debate.title,
        error_message=debate.error_message,
        created_at=debate.created_at,
        started_at=debate.started_at,
        ended_at=debate.ended_at,
        settings=DebateSettingsOut(
            topic=conf.get("topic", ""),
            description=conf.get("description"),
            language=conf.get("language", "English"),
            language_code=language_code(conf.get("language")),
            num_rounds=int(conf.get("num_rounds") or 1),
            length_preset=conf.get("length_preset", "medium"),
            intensity=int(conf.get("intensity") or 5),
            output_style=conf.get("output_style") or "markdown",
        ),
        totals=_totals(debate),
        participants=[
            ParticipantOut(
                id=f"participant_{i}",  # rows are inserted in config order
                name=p.persona_name,
                role=p.role,
                model=p.model_id,
                voice_name=p.voice_name,
                avatar=p.avatar_url,
            )
            for i, p in enumerate(debate.participants)
        ],
        turns=[_turn_out(t) for t in debate.turns],
    )


@router.post("/{debate_id}/stop", response_model=StopDebateResponse)
async def stop_debate(debate_id: str, db: AsyncSession = Depends(get_db)) -> StopDebateResponse:
    """Stop a queued or running debate. The current turn finishes early."""
    uuid_id = _parse_uuid(debate_id)
    debate = await db.get(Debate, uuid_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status not in ("queued", "running"):
        raise HTTPException(status_code=409, detail=f"Debate is already {debate.status}")

    debate.status = "stopped"
    debate.ended_at = utcnow()
    await db.commit()

    try:
        await get_async_redis().set(stop_flag_key(debate_id), "1", ex=3600)
    except RedisError:
        logger.warning("Could not set stop flag for %s; worker will stop at next turn", debate_id)
    await publish_event_async(
        debate_id, "debate_stopped", {"debate_id": debate_id, "status": "stopped"}
    )
    return StopDebateResponse(debate_id=debate_id, status="stopped")


@router.delete("/{debate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debate(debate_id: str, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a debate and its history."""
    uuid_id = _parse_uuid(debate_id)
    debate = await db.get(Debate, uuid_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status in ("queued", "running"):
        # Make sure the worker stops touching it.
        with contextlib.suppress(RedisError):
            await get_async_redis().set(stop_flag_key(debate_id), "1", ex=3600)
    await db.delete(debate)
    await db.commit()
    await run_in_threadpool(shutil.rmtree, MediaPaths(debate_id).dir, True)
