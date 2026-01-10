from fastapi import APIRouter
from app.services.openrouter_client import openrouter_client
from app.schemas.schemas import ModelsResponse, ValidateModelsRequest, ValidateModelsResponse, ValidationResult
import time
import asyncio

router = APIRouter()

@router.get("", response_model=ModelsResponse)
async def get_models():
    """
    Get list of available models from OpenRouter.
    """
    models = await openrouter_client.get_models()
    return {
        "data": models,
        "timestamp": time.time()
    }

@router.post("/validate", response_model=ValidateModelsResponse)
async def validate_models(request: ValidateModelsRequest):
    """
    Validate a list of models by sending a short prompt to each.
    """
    results = []
    
    async def check_one(model_id):
        is_ok = await openrouter_client.validate_model(model_id)
        return ValidationResult(
            model_id=model_id,
            status="ok" if is_ok else "error"
        )

    tasks = [check_one(mid) for mid in request.model_ids]
    results = await asyncio.gather(*tasks)
    
    return {"results": results}
