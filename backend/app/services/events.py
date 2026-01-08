import json
import redis
from app.core.config import settings

# Dedicated PubSub connection
redis_pub = redis.from_url(settings.REDIS_URL)

def publish_event(debate_id: str, event_type: str, payload: dict):
    """
    Publish a structured event to the debate channel.
    Channel: debate:{debate_id}
    Format: JSON {event: 'name', data: {...}}
    """
    channel = f"debate:{debate_id}"
    message = json.dumps({
        "event": event_type,
        "data": payload
    })
    redis_pub.publish(channel, message)
