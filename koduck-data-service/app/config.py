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

    # K-line local file storage
    # Supported: "csv", "parquet", "parquet.zst"
    KLINE_STORAGE_FORMAT: str = "parquet.zst"
    KLINE_COMPRESSION_LEVEL: int = 6
    KLINE_LEGACY_CSV_FALLBACK: bool = True

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
    TICK_PARTITION_MONTHS_AHEAD: int = 3  # Pre-create partitions for N months ahead
    
    # Tick Cache Configuration
    TICK_CACHE_TTL_LATEST: int = 300  # 5 minutes
    TICK_CACHE_TTL_BATCH: int = 3600  # 1 hour
    TICK_CACHE_TTL_METRICS: int = 60  # 1 minute
    
    # Tick Monitor Configuration
    TICK_MONITOR_ENABLED: bool = True
    TICK_MONITOR_INTERVAL_SECONDS: int = 60  # Check interval
    TICK_MONITOR_MAX_LATENCY_MS: int = 5000  # 5 seconds
    TICK_MONITOR_MAX_GAP_SECONDS: int = 300  # 5 minutes
    TICK_MONITOR_MIN_TICKS_PER_HOUR: int = 10
    TICK_MONITOR_ALERT_COOLDOWN_SECONDS: int = 3600  # 1 hour between same alerts

    # Realtime scheduler behavior
    # Default: update only during trading sessions; no updates after market close.
    REALTIME_ONLY_DURING_TRADING_HOURS: bool = True
    # Legacy switch: when ONLY_DURING is False, skip updates during trading.
    REALTIME_SKIP_DURING_TRADING_HOURS: bool = False

    # Market daily net-flow scheduler behavior
    MARKET_NET_FLOW_ENABLED: bool = True
    MARKET_NET_FLOW_TRADING_INTERVAL_SECONDS: int = 60
    MARKET_NET_FLOW_NON_TRADING_INTERVAL_SECONDS: int = 600

    # Market daily breadth scheduler behavior
    MARKET_BREADTH_ENABLED: bool = True
    MARKET_BREADTH_TRADING_INTERVAL_SECONDS: int = 60
    MARKET_BREADTH_NON_TRADING_INTERVAL_SECONDS: int = 600

    # Market sector net-flow scheduler behavior
    MARKET_SECTOR_NET_FLOW_ENABLED: bool = True
    MARKET_SECTOR_NET_FLOW_TRADING_INTERVAL_SECONDS: int = 300
    MARKET_SECTOR_NET_FLOW_NON_TRADING_INTERVAL_SECONDS: int = 1800

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # RabbitMQ realtime price push
    PRICE_PUSH_MQ_ENABLED: bool = False
    RABBITMQ_HOST: str = "localhost"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USERNAME: str = "guest"
    RABBITMQ_PASSWORD: str = "guest"
    RABBITMQ_VHOST: str = "/"
    PRICE_PUSH_MQ_EXCHANGE: str = "koduck.price.exchange"
    PRICE_PUSH_MQ_QUEUE: str = "koduck.price.realtime.queue"
    PRICE_PUSH_MQ_ROUTING_KEY: str = "stock.realtime"
    PRICE_PUSH_MQ_DLX: str = "koduck.price.dlx"
    PRICE_PUSH_MQ_DLQ: str = "koduck.price.realtime.dlq"
    PRICE_PUSH_MQ_DLK: str = "stock.realtime.dlq"


# Global settings instance
settings = Settings()
