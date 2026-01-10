import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.openrouter_client import openrouter_client
from app.core.config import settings

async def test():
    # 1. Fetch models to find a Parasail one if possible, or just use a common free one
    print("Fetching models...")
    models = await openrouter_client.get_models()
    
    # Debug: Print models
    # print(models) 
    
    # Find a free model
    target_model = None
    for m in models:
        # Search for one that might be free or commonly used
        if "free" in m['id']:
            target_model = m['id']
            print(f"Found free model: {target_model}")
            break
            
    if not target_model:
        target_model = "google/gemini-2.0-flash-exp:free"

    print(f"Testing model: {target_model}")
    
    # Test 1: Validation style (User role, Short, Stream=True, MaxTokens=5)
    print("\n--- Test 1: Validation Style ---")
    try:
        success = await openrouter_client.validate_model(target_model)
        print(f"Validation Result: {success}")
    except Exception as e:
        print(f"Validation Exception: {e}")

    # Test 2: Chat style (System + User, Long context, Stream=True, No MaxTokens)
    print("\n--- Test 2: Chat Style (System Prompt) ---")
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum physics in one sentence."}
    ]
    
    try:
        print("Streaming response...")
        async for chunk in openrouter_client.create_chat_completion(target_model, messages):
            print(chunk, end="", flush=True)
        print("\nDone.")
    except Exception as e:
        print(f"\nChat Exception: {e}")

    # Test 3: Chat Style NO SYSTEM PROMPT
    print("\n--- Test 3: Chat Style (No System Prompt) ---")
    messages_no_sys = [
        {"role": "user", "content": "Explain quantum physics in one sentence."}
    ]
    try:
        print("Streaming response...")
        async for chunk in openrouter_client.create_chat_completion(target_model, messages_no_sys):
            print(chunk, end="", flush=True)
        print("\nDone.")
    except Exception as e:
        print(f"\nChat Exception: {e}")

    # Test 4: Chat Style WITH MAX TOKENS (Manually calling raw request to simulate)
    print("\n--- Test 4: Chat Style (With Max Tokens) ---")
    # We need to manually call the client logic here roughly, or rely on create_chat_completion if we could pass max_tokens.
    # But create_chat_completion doesn't take max_tokens.
    # So we'll valid_model style but with chat prompt.
    import httpx
    import json
    
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Debates",
    }
    
    payload = {
        "model": target_model,
        "messages": messages, # WITH system prompt
        "stream": True,
        "max_tokens": 100
    }

    try:
        print("Streaming response...")
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers) as response:
                if response.status_code != 200:
                    err = await response.aread()
                    print(f"Error {response.status_code}: {err}")
                else:
                    async for line in response.aiter_lines():
                        if line.strip().startswith("data: "):
                            data_str = line.strip()[6:]
                            if data_str == "[DONE]": break
                            try:
                                chunk = json.loads(data_str)
                                delta = chunk["choices"][0].get("delta", {}).get("content", "")
                                print(delta, end="", flush=True)
                            except: pass
        print("\nDone.")
    except Exception as e:
        print(f"\nChat Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test())
