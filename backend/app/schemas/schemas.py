from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LengthPreset = Literal["very_short", "short", "medium", "long"]
ParticipantRole = Literal["moderator", "debater"]


# --- Preset Schemas ---
class Preset(BaseModel):
    id: str
    name: str
    description: str | None = None
    preset_json: dict[str, Any]
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
    data: list[ModelInfo]
    timestamp: float


class CreditsResponse(BaseModel):
    credits: float | None = None
    error: str | None = None


class ValidateModelsRequest(BaseModel):
    model_ids: list[str] = Field(min_length=1, max_length=10)
    api_key: str | None = None


class ValidationResult(BaseModel):
    model_id: str
    status: Literal["ok", "error"]
    error: str | None = None


class ValidateModelsResponse(BaseModel):
    results: list[ValidationResult]


# --- Debate Creation Schemas ---
class ParticipantConfig(BaseModel):
    role: ParticipantRole
    model_id: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=500)
    voice_name: str | None = Field(default=None, max_length=200)
    persona_preset: str | None = None
    persona_custom: str | None = Field(default=None, max_length=4000)


class DebateConfig(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=4000)
    language: str = Field(default="English", max_length=50)
    participants: list[ParticipantConfig] = Field(min_length=1, max_length=8)
    debate_preset_id: str | None = "custom"
    length_preset: LengthPreset = "medium"
    num_rounds: int = Field(default=3, ge=1, le=10)
    intensity: int = Field(default=5, ge=1, le=10)
    # Optional BYOK OpenRouter key. Never persisted to the database.
    user_provider_key: str | None = Field(default=None, max_length=300)

    @field_validator("participants")
    @classmethod
    def _validate_participants(cls, value: list[ParticipantConfig]) -> list[ParticipantConfig]:
        debaters = [p for p in value if p.role == "debater"]
        moderators = [p for p in value if p.role == "moderator"]
        if not debaters:
            raise ValueError("At least one debater is required")
        if len(moderators) > 1:
            raise ValueError("At most one moderator is allowed")
        return value


class DebateResponse(BaseModel):
    debate_id: str
    status: str
    message: str


# --- Debate Read Schemas ---
class TurnUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost: float = 0.0


class DebateTotals(BaseModel):
    tokens_in: int = 0
    tokens_out: int = 0
    cost: float = 0.0
    turns_count: int = 0


class TurnOut(BaseModel):
    seq_index: int
    round_id: str
    turn_type: str
    speaker_role: ParticipantRole
    speaker_name: str
    text: str
    error: str | None = None
    model_used: str
    usage: TurnUsage = Field(default_factory=TurnUsage)
    created_at: datetime | None = None


class ParticipantOut(BaseModel):
    name: str | None
    role: str
    model: str
    voice_name: str | None = None
    avatar: str | None = None


class DebateSummary(BaseModel):
    id: str
    title: str | None
    status: str
    created_at: datetime
    totals: DebateTotals = Field(default_factory=DebateTotals)


class DebateSettingsOut(BaseModel):
    topic: str
    description: str | None = None
    language: str
    num_rounds: int
    length_preset: str
    intensity: int


class DebateDetail(BaseModel):
    id: str
    status: str
    title: str | None
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    settings: DebateSettingsOut
    totals: DebateTotals = Field(default_factory=DebateTotals)
    participants: list[ParticipantOut]
    turns: list[TurnOut]


class StopDebateResponse(BaseModel):
    debate_id: str
    status: str
