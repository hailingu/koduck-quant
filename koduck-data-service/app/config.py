"""Application configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # Server settings
    APP_NAME: str = "Koduck Data Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Network settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Redis settings
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TIMEOUT: int = 5
    
    # Cache settings
    CACHE_TTL_SHORT: int = 30  # seconds
    CACHE_TTL_MEDIUM: int = 300  # 5 minutes
    CACHE_TTL_LONG: int = 3600  # 1 hour
    
    # AKShare settings
    AKSHARE_TIMEOUT: int = 30
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


# Global settings instance
settings = Settings()
