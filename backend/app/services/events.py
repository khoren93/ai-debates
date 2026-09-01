"""Publish debate events to Redis pub/sub (consumed by the SSE endpoint)."""

import json
import logging
from typing import Any

from app.core.redis import debate_channel, get_async_redis, get_sync_redis

logger = logging.getLogger(__name__)

TERMINAL_EVENTS = frozenset({"debate_completed", "debate_error", "debate_stopped"})


def _encode(event_type: str, payload: dict[str, Any]) -> str:
    return json.dumps({"event": event_type, "data": payload}, default=str)


def publish_event(debate_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Blocking publish, used by the worker."""
    try:
        get_sync_redis().publish(debate_channel(debate_id), _encode(event_type, payload))
    except Exception:
        logger.exception("Failed to publish %s for debate %s", event_type, debate_id)


async def publish_event_async(debate_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Non-blocking publish, used by the API."""
    try:
        await get_async_redis().publish(debate_channel(debate_id), _encode(event_type, payload))
    except Exception:
        logger.exception("Failed to publish %s for debate %s", event_type, debate_id)
