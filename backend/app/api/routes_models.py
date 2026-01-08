from fastapi import APIRouter
from app.services.openrouter_client import openrouter_client
from app.schemas.schemas import ModelsResponse
import time

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
