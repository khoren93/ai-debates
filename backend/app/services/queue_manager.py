"""RQ job enqueueing. Job functions are referenced by dotted path so the API
never imports the worker-only orchestrator module."""

from rq import Queue

from app.core.config import settings
from app.core.redis import get_sync_redis

QUEUE_NAME = "default"

_ORCHESTRATOR = "app.services.orchestrator"


def get_queue() -> Queue:
    return Queue(QUEUE_NAME, connection=get_sync_redis())


def _enqueue(func_name: str, **kwargs: object) -> None:
    get_queue().enqueue(
        f"{_ORCHESTRATOR}.{func_name}",
        job_timeout=settings.TURN_JOB_TIMEOUT,
        result_ttl=300,
        failure_ttl=3600,
        **kwargs,
    )


def enqueue_debate_start(debate_id: str) -> None:
    _enqueue("start_debate_job", debate_id=debate_id)


def enqueue_turn(debate_id: str, seq_index: int) -> None:
    _enqueue("process_turn_job", debate_id=debate_id, seq_index=seq_index)


def enqueue_verdict(debate_id: str, seq_index: int) -> None:
    _enqueue("conduct_verdict_job", debate_id=debate_id, seq_index=seq_index)


def enqueue_finish(debate_id: str) -> None:
    _enqueue("finish_debate_job", debate_id=debate_id)
