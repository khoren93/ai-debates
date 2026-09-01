"""Print raw OpenRouter account info for the configured key.

Usage (from backend/):  uv run python scripts/check_balance.py
"""

import asyncio

import httpx

from app.core.config import settings


async def main() -> None:
    headers = {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        for path in ("/credits", "/auth/key"):
            print(f"GET {path}")
            try:
                resp = await client.get(f"{settings.OPENROUTER_BASE_URL}{path}", headers=headers)
                print(f"  {resp.status_code}: {resp.text}")
            except httpx.HTTPError as e:
                print(f"  error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
