"""RQ worker entrypoint: `python -m app.worker`."""

import logging

from rq import Queue, SimpleWorker, Worker

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.redis import get_sync_redis
from app.services.queue_manager import QUEUE_NAME

logger = logging.getLogger(__name__)


def main() -> None:
    setup_logging()
    conn = get_sync_redis()
    conn.ping()
    queues = [Queue(QUEUE_NAME, connection=conn)]
    # SimpleWorker runs jobs in-process (no fork). Handy on macOS for local dev.
    worker_cls = SimpleWorker if settings.RQ_SIMPLE_WORKER else Worker
    worker = worker_cls(queues, connection=conn)
    logger.info("Starting %s on queue '%s'", worker_cls.__name__, QUEUE_NAME)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
