import os
import redis
from rq import Worker, Queue

listen = ['default']

redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')

try:
    conn = redis.from_url(redis_url)
except Exception as e:
    print(f"Error connecting to Redis: {e}")
    conn = None

if __name__ == '__main__':
    if conn:
        # Create queues with explicit connection
        queues = [Queue(name, connection=conn) for name in listen]
        worker = Worker(queues, connection=conn)
        print("Starting RQ worker...")
        worker.work()
    else:
        print("Could not start worker due to missing Redis connection.")
