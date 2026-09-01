"""RQ jobs that drive a debate: start -> turn* -> verdict -> finish.

Runs in the worker process only. Uses a blocking SQLAlchemy engine because RQ
jobs are synchronous; LLM streaming happens inside a short-lived asyncio loop.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.redis import get_sync_redis, provider_key_key, stop_flag_key
from app.models.models import Debate, Turn, utcnow
from app.services import queue_manager
from app.services.events import publish_event
from app.services.openrouter_client import OpenRouterClient, OpenRouterError
from app.services.prompt_builder import (
    build_debater_messages,
    build_moderator_messages,
    build_verdict_messages,
)
from app.services.scheduler import ScheduledTurn, build_schedule, speaker_role_for

logger = logging.getLogger(__name__)

VERDICT_SPEAKER_NAME = "⚖️ Verdict"
STOP_CHECK_EVERY_N_CHUNKS = 10

_SessionLocal: sessionmaker[Session] | None = None


def get_session() -> Session:
    """Blocking DB session. The engine is created lazily so that forked RQ
    work-horses never share a connection pool with the parent process."""
    global _SessionLocal
    if _SessionLocal is None:
        engine = create_engine(settings.sync_database_url, poolclass=NullPool)
        _SessionLocal = sessionmaker(bind=engine)
    return _SessionLocal()


# --- helpers ---------------------------------------------------------------


@dataclass
class GenerationResult:
    text: str = ""
    usage: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    stopped: bool = False


def _normalize_usage(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw:
        return {}
    return {
        "prompt_tokens": int(raw.get("prompt_tokens") or 0),
        "completion_tokens": int(raw.get("completion_tokens") or 0),
        "total_tokens": int(raw.get("total_tokens") or 0),
        "cost": float(raw.get("cost") or 0.0),
    }


def _serialize_turn(turn: Turn) -> dict[str, Any]:
    return {
        "seq_index": turn.seq_index,
        "round_id": turn.round_id,
        "turn_type": turn.turn_type,
        "speaker_role": speaker_role_for(turn.turn_type),
        "speaker_name": turn.speaker_name,
        "text": turn.text,
        "error": turn.error,
        "model_used": turn.model_used,
        "usage": turn.usage_json or {},
        "created_at": turn.created_at.isoformat() if turn.created_at else None,
    }


def _history(db: Session, debate_id: uuid.UUID) -> list[dict[str, Any]]:
    turns = db.scalars(
        select(Turn).where(Turn.debate_id == debate_id).order_by(Turn.seq_index)
    ).all()
    return [
        {"speaker_name": t.speaker_name, "text": t.text, "turn_type": t.turn_type}
        for t in turns
        if t.text and t.text.strip()
    ]


def _compute_totals(db: Session, debate_id: uuid.UUID) -> dict[str, Any]:
    turns = db.scalars(select(Turn).where(Turn.debate_id == debate_id)).all()
    totals = {"tokens_in": 0, "tokens_out": 0, "cost": 0.0, "turns_count": len(turns)}
    for t in turns:
        usage = t.usage_json or {}
        totals["tokens_in"] += int(usage.get("prompt_tokens") or 0)
        totals["tokens_out"] += int(usage.get("completion_tokens") or 0)
        totals["cost"] += float(usage.get("cost") or 0.0)
    totals["cost"] = round(totals["cost"], 6)
    return totals


def _cleanup_keys(debate_id: str) -> None:
    try:
        get_sync_redis().delete(provider_key_key(debate_id), stop_flag_key(debate_id))
    except Exception:
        logger.warning("Failed to clean up Redis keys for debate %s", debate_id)


def _provider_key(debate_id: str) -> str | None:
    try:
        value = get_sync_redis().get(provider_key_key(debate_id))
    except Exception:
        logger.warning("Failed to read provider key for debate %s", debate_id)
        return None
    if value is None:
        return None
    return value.decode() if isinstance(value, bytes) else str(value)


def _stop_requested(debate_id: str) -> bool:
    try:
        return bool(get_sync_redis().exists(stop_flag_key(debate_id)))
    except Exception:
        return False


def _fail_debate(db: Session, debate: Debate, message: str) -> None:
    logger.error("Debate %s failed: %s", debate.id, message)
    debate.status = "error"
    debate.error_message = message[:2000]
    debate.ended_at = utcnow()
    debate.totals_json = _compute_totals(db, debate.id)
    db.commit()
    _cleanup_keys(str(debate.id))
    publish_event(str(debate.id), "debate_error", {"debate_id": str(debate.id), "message": message})


def _finalize_stopped(db: Session, debate: Debate) -> None:
    debate.status = "stopped"
    debate.ended_at = debate.ended_at or utcnow()
    debate.totals_json = _compute_totals(db, debate.id)
    db.commit()
    _cleanup_keys(str(debate.id))


def _generate(
    debate_id: str,
    seq_index: int,
    speaker_name: str,
    model_id: str,
    messages: list[dict[str, Any]],
    api_key: str | None,
) -> GenerationResult:
    """Stream one LLM response, forwarding deltas to subscribers."""

    async def run() -> GenerationResult:
        client = OpenRouterClient()
        result = GenerationResult()
        chunks = 0
        try:
            async for chunk in client.stream_chat_completion(model_id, messages, api_key=api_key):
                if chunk.usage:
                    result.usage = _normalize_usage(chunk.usage)
                if not chunk.delta:
                    continue
                result.text += chunk.delta
                publish_event(
                    debate_id,
                    "turn_delta",
                    {"seq_index": seq_index, "delta": chunk.delta, "speaker_name": speaker_name},
                )
                chunks += 1
                if chunks % STOP_CHECK_EVERY_N_CHUNKS == 0 and _stop_requested(debate_id):
                    result.stopped = True
                    break
        except OpenRouterError as e:
            result.error = str(e)
        except Exception as e:
            logger.exception("Unexpected generation error for debate %s", debate_id)
            result.error = f"Unexpected error: {e}"
        return result

    return asyncio.run(run())


def _save_turn(
    db: Session,
    debate: Debate,
    *,
    seq_index: int,
    round_id: str,
    turn_type: str,
    speaker_id: str,
    speaker_name: str,
    model_id: str,
    result: GenerationResult,
) -> Turn:
    turn = Turn(
        debate_id=debate.id,
        seq_index=seq_index,
        round_id=round_id,
        turn_type=turn_type,
        speaker_id=speaker_id,
        speaker_name=speaker_name,
        text=result.text,
        error=result.error,
        word_count=len(result.text.split()),
        model_used=model_id,
        usage_json=result.usage,
    )
    db.add(turn)
    db.commit()
    db.refresh(turn)
    payload = _serialize_turn(turn)
    publish_event(str(debate.id), "turn_error" if result.error else "turn_completed", payload)
    if result.error:
        logger.warning("Turn %s of debate %s failed: %s", seq_index, debate.id, result.error)
    return turn


# --- jobs ------------------------------------------------------------------


def start_debate_job(debate_id: str) -> None:
    with get_session() as db:
        debate = db.get(Debate, uuid.UUID(debate_id))
        if not debate:
            logger.warning("Debate %s not found", debate_id)
            return
        if debate.status != "queued":
            logger.info("Debate %s is %s, not starting", debate_id, debate.status)
            return

        debate.status = "running"
        debate.started_at = utcnow()
        db.commit()
        publish_event(debate_id, "debate_started", {"debate_id": debate_id, "status": "running"})
        queue_manager.enqueue_turn(debate_id, 0)


def process_turn_job(debate_id: str, seq_index: int) -> None:
    with get_session() as db:
        debate = db.get(Debate, uuid.UUID(debate_id))
        if not debate:
            return
        if debate.status == "stopped":
            _finalize_stopped(db, debate)
            return
        if debate.status != "running":
            return

        try:
            conf: dict[str, Any] = debate.config_json or {}
            participants: list[dict[str, Any]] = conf.get("participants", [])
            schedule = build_schedule(participants, int(conf.get("num_rounds") or 1))

            if seq_index >= len(schedule):
                queue_manager.enqueue_verdict(debate_id, seq_index)
                return

            turn: ScheduledTurn = schedule[seq_index]
            speaker = participants[turn.speaker_index]
            speaker_name = speaker.get("display_name") or (
                "Moderator" if turn.is_moderator else f"Debater {turn.speaker_index}"
            )
            model_id = speaker.get("model_id") or settings.DEFAULT_MODEL_ID
            history = _history(db, debate.id)
            build = build_moderator_messages if turn.is_moderator else build_debater_messages
            messages = build(conf, speaker, turn, history)

            publish_event(
                debate_id,
                "turn_started",
                {
                    "seq_index": seq_index,
                    "speaker_name": speaker_name,
                    "speaker_role": speaker_role_for(turn.turn_type),
                    "turn_type": turn.turn_type,
                    "round_id": turn.round_id,
                },
            )

            result = _generate(
                debate_id, seq_index, speaker_name, model_id, messages, _provider_key(debate_id)
            )
            _save_turn(
                db,
                debate,
                seq_index=seq_index,
                round_id=turn.round_id,
                turn_type=turn.turn_type,
                speaker_id=f"participant_{turn.speaker_index}",
                speaker_name=speaker_name,
                model_id=model_id,
                result=result,
            )

            if result.stopped or _stop_requested(debate_id):
                _finalize_stopped(db, debate)
                return
            queue_manager.enqueue_turn(debate_id, seq_index + 1)

        except Exception as e:
            logger.exception("Turn %s of debate %s crashed", seq_index, debate_id)
            db.rollback()
            _fail_debate(db, debate, f"Turn {seq_index} failed: {e}")


def conduct_verdict_job(debate_id: str, seq_index: int) -> None:
    with get_session() as db:
        debate = db.get(Debate, uuid.UUID(debate_id))
        if not debate:
            return
        if debate.status == "stopped":
            _finalize_stopped(db, debate)
            return
        if debate.status != "running":
            return

        try:
            conf: dict[str, Any] = debate.config_json or {}
            participants: list[dict[str, Any]] = conf.get("participants", [])
            moderator = next((p for p in participants if p.get("role") == "moderator"), None)
            model_id = (moderator or {}).get("model_id") or settings.DEFAULT_MODEL_ID

            publish_event(
                debate_id,
                "turn_started",
                {
                    "seq_index": seq_index,
                    "speaker_name": VERDICT_SPEAKER_NAME,
                    "speaker_role": "moderator",
                    "turn_type": "verdict",
                    "round_id": "verdict",
                },
            )
            messages = build_verdict_messages(conf, _history(db, debate.id))
            result = _generate(
                debate_id,
                seq_index,
                VERDICT_SPEAKER_NAME,
                model_id,
                messages,
                _provider_key(debate_id),
            )
            _save_turn(
                db,
                debate,
                seq_index=seq_index,
                round_id="verdict",
                turn_type="verdict",
                speaker_id="judge",
                speaker_name=VERDICT_SPEAKER_NAME,
                model_id=model_id,
                result=result,
            )
            queue_manager.enqueue_finish(debate_id)
        except Exception as e:
            logger.exception("Verdict for debate %s crashed", debate_id)
            db.rollback()
            _fail_debate(db, debate, f"Verdict failed: {e}")


def finish_debate_job(debate_id: str) -> None:
    with get_session() as db:
        debate = db.get(Debate, uuid.UUID(debate_id))
        if not debate:
            return
        if debate.status == "stopped":
            _finalize_stopped(db, debate)
            return
        if debate.status != "running":
            return

        debate.status = "completed"
        debate.ended_at = utcnow()
        debate.totals_json = _compute_totals(db, debate.id)
        db.commit()
        _cleanup_keys(debate_id)
        publish_event(
            debate_id,
            "debate_completed",
            {"debate_id": debate_id, "status": "completed", "totals": debate.totals_json},
        )
