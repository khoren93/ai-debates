"""Minimal fixed-window rate limiting backed by Redis."""

import logging

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis import get_async_redis, rate_limit_key

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 3600


def _client_id(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def enforce_debate_create_limit(request: Request) -> None:
    """FastAPI dependency: cap debates created per client IP per hour."""
    limit = settings.DEBATE_CREATE_RATE_LIMIT
    if limit <= 0:
        return

    key = rate_limit_key("create_debate", _client_id(request))
    try:
        redis = get_async_redis()
        async with redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, WINDOW_SECONDS, nx=True)
            pipe.ttl(key)
            count, _, ttl = await pipe.execute()
    except RedisError:
        logger.warning("Rate limiter unavailable; allowing request")
        return

    if int(count) > limit:
        retry_after = max(int(ttl), 1) if isinstance(ttl, int) else WINDOW_SECONDS
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many debates created. Try again in {retry_after // 60 + 1} minutes.",
            headers={"Retry-After": str(retry_after)},
        )
