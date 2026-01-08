from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# --- Preset Schemas ---
class Preset(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    preset_json: dict
    model_config = ConfigDict(from_attributes=True)

# --- Model Schemas ---
class ModelPricing(BaseModel):
    prompt: str
    completion: str

class ModelInfo(BaseModel):
    id: str
    name: str
    context_length: int
    pricing: ModelPricing
    is_free: bool

class ModelsResponse(BaseModel):
    data: List[ModelInfo]
    timestamp: float

# --- Debate Creation Schemas ---
class ParticipantConfig(BaseModel):
    # For moderator, only model_id and display_name are needed
    # For debaters, we need persona + style
    role: str # moderator | debater
    model_id: str
    display_name: str
    avatar_url: Optional[str] = None
    voice_name: Optional[str] = None
    persona_preset: Optional[str] = None
    persona_custom: Optional[str] = None

class DebateConfig(BaseModel):
    topic: str
    description: Optional[str] = None
    language: str = "English"
    participants: List[ParticipantConfig]
    debate_preset_id: Optional[str] = "custom"
    length_preset: str = "medium" # short, medium, long
    num_rounds: Optional[int] = 3
    intensity: int = 5
    user_provider_key: Optional[str] = None

class DebateResponse(BaseModel):
    debate_id: str
    status: str
    message: str
