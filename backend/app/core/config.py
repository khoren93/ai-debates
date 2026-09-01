from functools import cached_property
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

TERMINAL_DEBATE_STATUSES = frozenset({"completed", "error", "stopped"})


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Debates"
    ENVIRONMENT: Literal["development", "production"] = "development"
    LOG_LEVEL: str = "INFO"

    # Infrastructure. Defaults target a local `docker compose -f docker-compose.dev.yml up`.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_debates"
    REDIS_URL: str = "redis://localhost:6379/0"

    # OpenRouter
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    # Used only when a participant has no model configured.
    DEFAULT_MODEL_ID: str = "openai/gpt-4o-mini"
    MODELS_CACHE_TTL: int = 3600
    LLM_CONNECT_TIMEOUT: float = 15.0
    LLM_READ_TIMEOUT: float = 120.0

    # Worker
    TURN_JOB_TIMEOUT: int = 600  # seconds per LLM turn job
    # Run jobs in-process instead of forking (useful on macOS during development).
    RQ_SIMPLE_WORKER: bool = False
    # User-supplied OpenRouter keys are kept in Redis only for the lifetime of a debate.
    PROVIDER_KEY_TTL: int = 86400

    # Abuse protection: debates per hour per client IP. 0 disables the limit.
    DEBATE_CREATE_RATE_LIMIT: int = 20

    # Site / admin
    SITE_URL: str = "http://localhost"
    ADMIN_USER: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    SECRET_KEY: str = "secret-key-for-sessions-change-me"
    ALLOWED_ORIGINS: str = "http://localhost,http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=[".env", "../.env"],
        env_ignore_empty=True,
        case_sensitive=True,
        extra="ignore",
    )

    @cached_property
    def sync_database_url(self) -> str:
        """Blocking driver URL for the RQ worker (psycopg 3)."""
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://")

    @cached_property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def insecure_defaults(self) -> list[str]:
        """Names of secrets still set to their placeholder values."""
        found: list[str] = []
        if self.SECRET_KEY == "secret-key-for-sessions-change-me":
            found.append("SECRET_KEY")
        if self.ADMIN_PASSWORD == "changeme":
            found.append("ADMIN_PASSWORD")
        return found


settings = Settings()
