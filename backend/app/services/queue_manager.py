import redis
from rq import Queue
from app.core.config import settings

# Setup Redis connection
redis_conn = redis.from_url(settings.REDIS_URL)

# Setup Queue
q = Queue(connection=redis_conn)

def enqueue_debate_start(debate_id: str):
    """
    Enqueue the initial job to start the debate.
    Target function: app.services.orchestrator.start_debate_job
    """
    q.enqueue(
        "app.services.orchestrator.start_debate_job",
        debate_id=debate_id,
        job_timeout='5m' # Long timeout just in case
    )
