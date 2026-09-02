"""Audio/video pipeline endpoints.

- GET  /api/media/capabilities            what providers are configured
- GET  /api/media/voices                  voice catalogue + defaults for a debate's speakers
- GET  /api/debates/{id}/media            build status, progress, asset URLs
- POST /api/debates/{id}/media            start (or restart) the audio build
- DELETE /api/debates/{id}/media          remove generated files
Video is rendered in the browser from the timeline; the server never encodes video.
"""

import logging
import secrets
import shutil
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import TERMINAL_DEBATE_STATUSES, settings
from app.core.db import get_db
from app.core.ratelimit import enforce_media_create_limit
from app.core.redis import get_async_redis, tts_key_key
from app.models.models import Debate
from app.schemas.media import (
    DebateMediaOut,
    GenerateMediaRequest,
    MediaAccepted,
    MediaCapabilities,
    MediaOptions,
    MediaProgress,
    MediaStats,
    MediaUrls,
    VoiceOut,
    VoicesResponse,
)
from app.services.media.ffmpeg import ffmpeg_available
from app.services.media.languages import language_code
from app.services.media.paths import MediaPaths, public_url
from app.services.media.tts import PROVIDER_NAMES, SpeakerRef, TTSError, get_provider
from app.services.media.tts.elevenlabs import MODELS as ELEVENLABS_MODELS
from app.services.queue_manager import enqueue_media_build

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_uuid(debate_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(debate_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid debate id") from e


def _is_trusted(request: Request, media_token: str | None) -> bool:
    """Admin session or shared token bypass the daily limit on the system key."""
    if request.session.get("token") == "authenticated":
        return True
    return bool(
        settings.MEDIA_API_TOKEN
        and media_token
        and secrets.compare_digest(media_token, settings.MEDIA_API_TOKEN)
    )


def speaker_refs(participants: list[dict[str, Any]]) -> list[SpeakerRef]:
    refs: list[SpeakerRef] = []
    debater_index = 0
    for i, p in enumerate(participants):
        role = "moderator" if p.get("role") == "moderator" else "debater"
        refs.append(SpeakerRef(f"participant_{i}", role, debater_index if role == "debater" else 0))
        if role == "debater":
            debater_index += 1
    refs.append(SpeakerRef("judge", "judge", 0))
    return refs


def media_out(debate: Debate) -> DebateMediaOut:
    state: dict[str, Any] = debate.media_json or {}
    debate_id = str(debate.id)
    urls: MediaUrls | None = None
    stats: MediaStats | None = None
    if debate.media_status == "ready":
        version = str(state.get("finished_at") or "").replace(":", "").replace("+", "")[:20] or None
        urls = MediaUrls(
            timeline=public_url(debate_id, "timeline.json", version),
            full_mp3=public_url(debate_id, "full.mp3", version),
            full_wav=public_url(debate_id, "full.wav", version),
            base=public_url(debate_id, "").rstrip("/"),
        )
        stats = MediaStats.model_validate(state.get("stats") or {})
    options = MediaOptions.model_validate(state["options"]) if state.get("options") else None
    return DebateMediaOut(
        debate_id=debate_id,
        media_status=debate.media_status,  # type: ignore[arg-type]
        progress=MediaProgress(
            step=str(state.get("step") or ""),
            current=int(state.get("current") or 0),
            total=int(state.get("total") or 0),
            message=str(state.get("message") or ""),
            error=state.get("error"),
        ),
        options=options,
        urls=urls,
        stats=stats,
        started_at=_dt(state.get("started_at")),
        finished_at=_dt(state.get("finished_at")),
    )


def _dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


@router.get("/media/capabilities", response_model=MediaCapabilities)
async def media_capabilities() -> MediaCapabilities:
    has_key = bool(settings.ELEVENLABS_API_KEY)
    return MediaCapabilities(
        elevenlabs=has_key,
        edge=True,
        ffmpeg=await run_in_threadpool(ffmpeg_available),
        default_provider="elevenlabs" if has_key else "edge",
        default_model_id=settings.TTS_DEFAULT_MODEL_ID,
        elevenlabs_models=list(ELEVENLABS_MODELS),
        rate_limit_per_day=settings.MEDIA_CREATE_RATE_LIMIT,
    )


@router.get("/media/voices", response_model=VoicesResponse)
async def media_voices(
    provider: str = Query("edge"),
    language: str = Query("English"),
    debate_id: str | None = Query(None),
    x_tts_key: str | None = Header(default=None, alias="X-TTS-Key"),
    db: AsyncSession = Depends(get_db),
) -> VoicesResponse:
    """Voices for a provider, plus a default assignment for the debate's speakers."""
    if provider not in PROVIDER_NAMES:
        raise HTTPException(status_code=400, detail="Unknown provider")
    refs: list[SpeakerRef] = []
    if debate_id:
        debate = await db.get(Debate, _parse_uuid(debate_id))
        if not debate:
            raise HTTPException(status_code=404, detail="Debate not found")
        conf = debate.config_json or {}
        refs = speaker_refs(conf.get("participants", []))
        language = conf.get("language") or language
    code = language_code(language)
    tts = get_provider(provider, api_key=x_tts_key)
    if not tts.available():
        raise HTTPException(
            status_code=409, detail="ElevenLabs key is not configured (send X-TTS-Key or use Edge)"
        )
    try:
        voices = await run_in_threadpool(tts.list_voices, code)
        defaults = await run_in_threadpool(tts.default_voices, code, refs) if refs else {}
    except TTSError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return VoicesResponse(
        provider=provider,  # type: ignore[arg-type]
        voices=[
            VoiceOut(
                id=v.id,
                name=v.name,
                description=v.description,
                preview_url=v.preview_url,
                gender=v.gender,
                languages=list(v.languages),
            )
            for v in voices
        ],
        defaults=defaults,
    )


@router.get("/debates/{debate_id}/media", response_model=DebateMediaOut)
async def get_debate_media(debate_id: str, db: AsyncSession = Depends(get_db)) -> DebateMediaOut:
    debate = await db.get(Debate, _parse_uuid(debate_id))
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    return media_out(debate)


@router.post(
    "/debates/{debate_id}/media", response_model=MediaAccepted, status_code=status.HTTP_202_ACCEPTED
)
async def generate_debate_media(
    debate_id: str,
    body: GenerateMediaRequest,
    request: Request,
    x_media_token: str | None = Header(default=None, alias="X-Media-Token"),
    db: AsyncSession = Depends(get_db),
) -> MediaAccepted:
    """Queue the audio build (TTS per turn, mixing, timeline). Video is rendered client-side."""
    debate = await db.get(Debate, _parse_uuid(debate_id))
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status not in TERMINAL_DEBATE_STATUSES:
        raise HTTPException(status_code=409, detail="The debate has not finished yet")
    if debate.media_status in ("queued", "running"):
        raise HTTPException(status_code=409, detail="A media build is already in progress")
    if body.provider not in PROVIDER_NAMES:
        raise HTTPException(status_code=400, detail="Unknown provider")
    if body.provider == "elevenlabs":
        if not (body.user_tts_key or settings.ELEVENLABS_API_KEY):
            raise HTTPException(status_code=409, detail="ElevenLabs key is not configured")
        # The system key is paid: limit anonymous use. Own keys and trusted callers are free.
        if not body.user_tts_key and not _is_trusted(request, x_media_token):
            await enforce_media_create_limit(request)

    options = MediaOptions(provider=body.provider, model_id=body.model_id, voices=body.voices)
    state = dict(debate.media_json or {})
    state.update(
        {
            "options": options.model_dump(),
            "force": body.force,
            "step": "queued",
            "current": 0,
            "total": 0,
            "message": "Queued",
            "error": None,
            "started_at": None,
            "finished_at": None,
        }
    )
    debate.media_json = state
    debate.media_status = "queued"
    await db.commit()

    try:
        redis = get_async_redis()
        if body.user_tts_key:
            await redis.set(tts_key_key(debate_id), body.user_tts_key, ex=settings.PROVIDER_KEY_TTL)
        else:
            await redis.delete(tts_key_key(debate_id))
        await run_in_threadpool(enqueue_media_build, debate_id)
    except RedisError:
        logger.exception("Failed to enqueue media build for %s", debate_id)
        debate.media_status = "error"
        debate.media_json = {**state, "error": "Job queue unavailable"}
        await db.commit()
        raise HTTPException(
            status_code=503, detail="Job queue is unavailable, please try again later"
        ) from None

    return MediaAccepted(debate_id=debate_id, media_status="queued", message="Audio build queued")


@router.delete("/debates/{debate_id}/media", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debate_media(debate_id: str, db: AsyncSession = Depends(get_db)) -> None:
    debate = await db.get(Debate, _parse_uuid(debate_id))
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.media_status == "running":
        raise HTTPException(status_code=409, detail="A media build is in progress")
    paths = MediaPaths(debate_id)
    await run_in_threadpool(shutil.rmtree, paths.dir, True)
    debate.media_status = "none"
    debate.media_json = {}
    await db.commit()
