"""Manual smoke test for the OpenRouter client.

Usage (from backend/):  uv run python scripts/debug_openrouter.py [model_id]
"""

import asyncio
import sys

from app.core.logging import setup_logging
from app.services.openrouter_client import OpenRouterError, openrouter_client


async def main(model_id: str | None) -> None:
    setup_logging()
    credits, error = await openrouter_client.get_credits()
    print(f"Credits: {credits} (error: {error})")

    models = await openrouter_client.get_models()
    print(f"Models available: {len(models)}")
    if not model_id:
        free = [m for m in models if m["is_free"]]
        model_id = str((free[0] if free else models[0])["id"])
    print(f"Testing model: {model_id}")

    ok, err = await openrouter_client.validate_model(model_id)
    print(f"Validation: ok={ok} error={err}")

    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum physics in one sentence."},
    ]
    try:
        async for chunk in openrouter_client.stream_chat_completion(model_id, messages):
            if chunk.delta:
                print(chunk.delta, end="", flush=True)
            if chunk.usage:
                print(f"\n\nUsage: {chunk.usage}")
    except OpenRouterError as e:
        print(f"\nStream failed: {e}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else None))
