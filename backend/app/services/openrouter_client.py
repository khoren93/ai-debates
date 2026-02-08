import time
import httpx
import json
from typing import List, Dict, Any, AsyncGenerator, Tuple, Optional
from app.core.config import settings

class OpenRouterClient:
    BASE_URL = "https://openrouter.ai/api/v1"
    
    def __init__(self):
        self._models_cache: List[Dict[str, Any]] = []
        self._cache_time = 0
        self._cache_ttl = 3600  # 1 hour
    
    async def create_chat_completion(self, model: str, messages: List[Dict[str, Any]], api_key: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        Stream chat completion from OpenRouter.
        Yields content text chunks.
        """
        key = api_key or settings.OPENROUTER_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.SITE_URL,
            "X-Title": settings.PROJECT_NAME,
        }
        
        # Prepare attempts mechanism
        # Some models (especially on Parasail) fail with System prompts (Error 400).
        # We try standard first, then fallback to merged system prompt.
        
        attempts = ["standard"]
        # Check if we have a system prompt to potentially merge
        if any(m.get('role') == 'system' for m in messages):
            attempts.append("merged_system")
            
        # last_error = None
        
        for attempt in attempts:
            current_messages: List[Dict[str, Any]] = messages
            if attempt == "merged_system":
                # Merge logic: Prepend system content to first user message
                system_content = "\n".join([str(m.get('content', '')) for m in messages if m.get('role') == 'system'])
                non_system: List[Dict[str, Any]] = [m for m in messages if m.get('role') != 'system']
                if not non_system:
                    # Weird case: only system?
                    current_messages = [{"role": "user", "content": system_content}]
                else:
                    # Find first user message
                    first_user_idx = next((i for i, m in enumerate(non_system) if m.get('role') == 'user'), -1)
                    if first_user_idx >= 0:
                        non_system[first_user_idx] = non_system[first_user_idx].copy()
                        non_system[first_user_idx]['content'] = f"{system_content}\n\n{non_system[first_user_idx].get('content')}"
                        current_messages = non_system
                    else:
                        # No user message? Prepend one.
                        current_messages = [{"role": "user", "content": system_content}] + non_system

            payload: Dict[str, Any] = {
                "model": model,
                "messages": current_messages,
                "stream": True 
            }

            try:
                # print(f"[OpenRouter] Requesting {model} with attempt {attempt}...")
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream("POST", f"{self.BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                        if response.status_code != 200:
                            err_text = await response.aread()
                            err_decoded = err_text.decode('utf-8', errors='replace')
                            print(f"--- [OPENROUTER ERROR START] ---")
                            print(f"Model: {model}")
                            print(f"Status: {response.status_code}")
                            print(f"Response Body: {err_decoded}")
                            print(f"--- [OPENROUTER ERROR END] ---")
                            
                            # If it's a 400 error and we haven't tried merging yet, loop continue
                            if response.status_code == 400 and attempt == "standard" and "merged_system" in attempts:
                                print(f"OpenRouter 400 Error for {model}, retrying with merged system prompt...")
                                # last_error = Exception(...) # suppressed
                                continue
                            
                            raise Exception(f"OpenRouter Error {response.status_code}: {err_text.decode('utf-8', errors='replace')}")

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
                            # else:
                                # if line.strip():
                                    # print(f"[OpenRouter] Non-SSE line from {model}: {line}")

                # If we successfully streamed, return (break loop)
                return 
            except Exception as e:
                print(f"[OpenRouter] Attempt '{attempt}' failed for model {model}: {e}")
                # last_error = e # suppressed
                # Only suppress and retry if we have retries left and it was potentially a format issue
                if attempt == "standard" and "merged_system" in attempts:
                    continue
                raise e # Re-raise if final attempt

    async def validate_model(self, model: str, api_key: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """
        Quickly validate if a model is responding by asking it to say 'pong'.
        Returns (True, None) if successful, (False, error_message) otherwise.
        """
        key = api_key or settings.OPENROUTER_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": settings.PROJECT_NAME,
        }
        
        # Use stream=True to match production behavior
        payload: Dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": "say pong"}],
            "max_tokens": 20, 
            "stream": True,
            "provider": {"ignore": ["Hyperbolic"]} # Optional: Avoid providers that might have strict limits if needed
        }

        try:
            # Increased timeout to 30s for slow/cold models
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", f"{self.BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        # Ensure we consume the error to avoid hanging
                        err_text = await response.aread()
                        err_str = err_text.decode('utf-8', errors='replace')
                        
                        # Try to parse nice message
                        try:
                            err_json = json.loads(err_str)
                            if "error" in err_json:
                                error_obj = err_json["error"]
                                # Check metadata.raw first for more detail if message is generic or just to be safe
                                if "metadata" in error_obj and "raw" in error_obj["metadata"]:
                                    err_str = error_obj["metadata"]["raw"]
                                elif "message" in error_obj:
                                    err_str = error_obj["message"]
                        except:
                            pass
                        
                        # print(f"[OpenRouter] Validation Error {response.status_code} for {model}: {err_str}")
                        print(f"[OpenRouter] Validation Error {response.status_code} for {model}: {err_str}")
                        return False, err_str

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
                                    return True, None
                                # Some error chunks might look different
                                if "error" in chunk:
                                    msg = chunk.get('error', {}).get('message', "Unknown SSE Error")
                                    return False, msg
                            except:
                                continue
                
                    # The loop might finish without returning True if only keep-alives or empty?
                    # But usually we hit [DONE] or a chunk.
                    return True, None

        except httpx.TimeoutException:
            print(f"[OpenRouter] Timeout validating {model}")
            return False, "Connection timed out (30s limit)"
        except Exception as e:
            import traceback
            print(f"[OpenRouter] Validation EXCEPTION for {model}: {e}")
            traceback.print_exc()
            return False, str(e)


    async def get_credits(self, api_key: Optional[str] = None) -> float:
        """
        Get current account credits.
        """
        key = api_key or settings.OPENROUTER_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.BASE_URL}/credits", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return float(data.get("data", {}).get("total_credits", 0))
                return 0.0
        except Exception as e:
            print(f"Error fetching credits: {e}")
            return 0.0

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
                headers: Dict[str, str] = {}
                if settings.OPENROUTER_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.OPENROUTER_API_KEY}"
                
                response = await client.get(f"{self.BASE_URL}/models", headers=headers)
                response.raise_for_status()
                data = response.json().get("data", [])
                
                # Transform and filter
                processed_models: List[Dict[str, Any]] = []
                for model in data:
                    pricing = model.get("pricing", {})
                    prompt_price = float(pricing.get("prompt", "0"))
                    completion_price = float(pricing.get("completion", "0"))
                    
                    is_free = (prompt_price == 0.0 and completion_price == 0.0)
                    
                    processed_models.append({
                        "id": str(model.get("id")),
                        "name": str(model.get("name")),
                        "context_length": int(model.get("context_length", 0)),
                        "pricing": {
                            "prompt": str(pricing.get("prompt", "0")),
                            "completion": str(pricing.get("completion", "0"))
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
