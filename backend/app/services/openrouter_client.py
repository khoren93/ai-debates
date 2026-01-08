import time
import httpx
import json
from typing import List, Dict, Any, AsyncGenerator
from app.core.config import settings

class OpenRouterClient:
    BASE_URL = "https://openrouter.ai/api/v1"
    
    def __init__(self):
        self._models_cache: List[Dict[str, Any]] = []
        self._cache_time = 0
        self._cache_ttl = 3600  # 1 hour
    
    async def create_chat_completion(self, model: str, messages: List[Dict], api_key: str = None) -> AsyncGenerator[str, None]:
        """
        Stream chat completion from OpenRouter.
        Yields content text chunks.
        """
        key = api_key or settings.OPENROUTER_API_KEY
        # If no key is provided, we might still try if the model is free, but mostly we need key.
        # However, OpenRouter free models might accept requests without key? No, usually need key.
        # But we will let it fail if no key.
        
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000", # TODO: Configure
            "X-Title": settings.PROJECT_NAME,
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": True 
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", f"{self.BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                if response.status_code != 200:
                    err_text = await response.aread()
                    raise Exception(f"OpenRouter Error {response.status_code}: {err_text.decode('utf-8')}")

                async for line in response.aiter_lines():
                    if line.strip().startswith("data: "):
                        data_str = line.strip()[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0].get("delta", {}).get("content", "")
                            if delta:
                                yield delta
                        except json.JSONDecodeError:
                            continue

    async def get_models(self) -> List[Dict[str, Any]]:
        """
        Fetch models from OpenRouter with simple caching.
        Enriches data with 'is_free' flag.
        """
        current_time = time.time()
        
        # Return cached if valid
        if self._models_cache and (current_time - self._cache_time < self._cache_ttl):
            return self._models_cache
            
        async with httpx.AsyncClient() as client:
            try:
                # No auth needed for listing models typically, but good practice if they require it later
                headers = {}
                if settings.OPENROUTER_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.OPENROUTER_API_KEY}"
                
                response = await client.get(f"{self.BASE_URL}/models", headers=headers)
                response.raise_for_status()
                data = response.json().get("data", [])
                
                # Transform and filter
                processed_models = []
                for model in data:
                    pricing = model.get("pricing", {})
                    prompt_price = float(pricing.get("prompt", "0"))
                    completion_price = float(pricing.get("completion", "0"))
                    
                    is_free = (prompt_price == 0.0 and completion_price == 0.0)
                    
                    processed_models.append({
                        "id": model.get("id"),
                        "name": model.get("name"),
                        "context_length": model.get("context_length", 0),
                        "pricing": {
                            "prompt": pricing.get("prompt", "0"),
                            "completion": pricing.get("completion", "0")
                        },
                        "is_free": is_free
                    })
                
                self._models_cache = processed_models
                self._cache_time = current_time
                return processed_models
                
            except Exception as e:
                print(f"Error fetching models: {e}")
                # Fallback to empty list or cached
                return self._models_cache

openrouter_client = OpenRouterClient()
