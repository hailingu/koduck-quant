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
    # Cookie 有效期（秒），默认 1 小时，正常用户浏览网站不会每 5 分钟刷新 cookie
    EASTMONEY_COOKIE_TTL: int = 3600
    # 请求间隔（秒），默认 3 秒，更像人类操作，降低被封禁风险
    EASTMONEY_MIN_REQUEST_INTERVAL: float = 3.0
    
    # Tick History Storage Configuration
    # 历史 tick 数据存储配置
    TICK_HISTORY_ENABLED: bool = True              # 是否启用历史 tick 存储
    TICK_RETENTION_DAYS: int = 30                  # 默认保留天数
    TICK_SAMPLING_INTERVAL: int = 0                # 抽样间隔（秒），0表示全量存储
    TICK_BATCH_SIZE: int = 100                     # 批量写入大小
    TICK_WRITE_ASYNC: bool = True                  # 是否异步写入
    TICK_PARTITION_RETENTION_MONTHS: int = 3       # 分区保留月数（用于自动清理）
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


# Global settings instance
settings = Settings()
