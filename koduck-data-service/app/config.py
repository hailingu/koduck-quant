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

    # PostgreSQL settings
    POSTGRES_HOST: str = "postgresql"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "koduck_dev"
    POSTGRES_USER: str = "koduck"
    POSTGRES_PASSWORD: str = "koduck"

    # Redis settings
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TIMEOUT: int = 5

    # Cache settings
    CACHE_TTL_SHORT: int = 30  # seconds
    CACHE_TTL_MEDIUM: int = 300  # 5 minutes
    CACHE_TTL_LONG: int = 3600  # 1 hour

    # AKShare settings
    AKSHARE_TIMEOUT: int = 30

    # Bootstrap completeness thresholds
    # Re-run stock_basic initialization until at least this many rows exist.
    STOCK_BASIC_MIN_COUNT: int = 3000

    # Eastmoney Client Settings
    # Cookie lifetime in seconds (default: 1 hour)
    EASTMONEY_COOKIE_TTL: int = 3600
    # Request interval in seconds; default is 3.0 to reduce ban risk
    EASTMONEY_MIN_REQUEST_INTERVAL: float = 3.0

    # Tick History Storage Configuration
    TICK_HISTORY_ENABLED: bool = True
    TICK_RETENTION_DAYS: int = 30
    TICK_SAMPLING_INTERVAL: int = 0
    TICK_BATCH_SIZE: int = 100
    TICK_WRITE_ASYNC: bool = True
    TICK_PARTITION_RETENTION_MONTHS: int = 3

    # Realtime scheduler behavior
    # Default: update only during trading sessions; no updates after market close.
    REALTIME_ONLY_DURING_TRADING_HOURS: bool = True
    # Legacy switch: when ONLY_DURING is False, skip updates during trading.
    REALTIME_SKIP_DURING_TRADING_HOURS: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


# Global settings instance
settings = Settings()
