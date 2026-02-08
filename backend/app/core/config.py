from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Debates"
    API_V1_STR: str = ""
    
    # Database
    DATABASE_URL: str = ""
    
    # Redis
    REDIS_URL: str = ""
    
    # External APIs
    OPENROUTER_API_KEY: Optional[str] = None
    
    # Production Secrets & Site Config
    SITE_URL: str = "https://ai-debates.net"
    ADMIN_USER: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    SECRET_KEY: str = "secret-key-for-sessions-change-me"

    # Production
    ALLOWED_ORIGINS: str = "https://ai-debates.net,http://localhost,https://localhost,http://localhost:3000,http://localhost:5173"
    
    model_config = SettingsConfigDict(
        env_file=[".env", "../.env"],
        env_ignore_empty=True,
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
