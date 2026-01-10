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
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000", # TODO: Configure
            "X-Title": settings.PROJECT_NAME,
        }
        
        # Prepare attempts mechanism
        # Some models (especially on Parasail) fail with System prompts (Error 400).
        # We try standard first, then fallback to merged system prompt.
        
        attempts = ["standard"]
        # Check if we have a system prompt to potentially merge
        if any(m['role'] == 'system' for m in messages):
            attempts.append("merged_system")
            
        last_error = None
        
        for attempt in attempts:
            current_messages = messages
            if attempt == "merged_system":
                # Merge logic: Prepend system content to first user message
                system_content = "\n".join([m['content'] for m in messages if m['role'] == 'system'])
                non_system = [m for m in messages if m['role'] != 'system']
                if not non_system:
                    # Weird case: only system?
                    current_messages = [{"role": "user", "content": system_content}]
                else:
                    # Find first user message
                    first_user_idx = next((i for i, m in enumerate(non_system) if m['role'] == 'user'), -1)
                    if first_user_idx >= 0:
                        non_system[first_user_idx] = non_system[first_user_idx].copy()
                        non_system[first_user_idx]['content'] = f"{system_content}\n\n{non_system[first_user_idx]['content']}"
                        current_messages = non_system
                    else:
                        # No user message? Prepend one.
                        current_messages = [{"role": "user", "content": system_content}] + non_system

            payload = {
                "model": model,
                "messages": current_messages,
                "stream": True 
            }

            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream("POST", f"{self.BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                        if response.status_code != 200:
                            err_text = await response.aread()
                            # If it's a 400 error and we haven't tried merging yet, loop continue
                            if response.status_code == 400 and attempt == "standard" and "merged_system" in attempts:
                                print(f"OpenRouter 400 Error for {model}, retrying with merged system prompt...")
                                last_error = Exception(f"OpenRouter Error {response.status_code}: {err_text.decode('utf-8')}")
                                continue
                            
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
                # If we successfully streamed, return (break loop)
                return 
            except Exception as e:
                last_error = e
                # Only suppress and retry if we have retries left and it was potentially a format issue
                if attempt == "standard" and "merged_system" in attempts:
                    continue
                raise e # Re-raise if final attempt

    async def validate_model(self, model: str, api_key: str = None) -> bool:
        """
        Quickly validate if a model is responding by asking it to say 'pong'.
        Returns True if successful, False otherwise.
        """
        key = api_key or settings.OPENROUTER_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": settings.PROJECT_NAME,
        }
        
        # Use stream=True to match production behavior
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "say pong"}],
            "max_tokens": 5,
            "stream": True
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                async with client.stream("POST", f"{self.BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        # Ensure we consume the error to avoid hanging
                        await response.aread()
                        return False

                    # Check if we can get at least one chunk of data
                    async for line in response.aiter_lines():
                        if line.strip().startswith("data: "):
                            data_str = line.strip()[6:]
                            if data_str == "[DONE]":
                                break # If we got here, it's valid
                            
                            # Check for Error response in data stream (OpenRouter sometimes sends json error instead of SSE)
                            # But usually strictly SSE format "data: {...}"
                            
                            try:
                                chunk = json.loads(data_str)
                                # Just need one valid chunk to confirm auth and connection
                                if "choices" in chunk:
                                    return True
                                # Some error chunks might look different
                                if "error" in chunk:
                                    return False
                            except:
                                continue
                
                    # The loop might finish without returning True if only keep-alives or empty?
                    # But usually we hit [DONE] or a chunk.
                    return True

        except Exception as e:
            print(f"Validation error for {model}: {e}")
            return False


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
