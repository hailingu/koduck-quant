"""FastAPI main application entry point."""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from time import perf_counter

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import Database
from app.models.schemas import ApiResponse, HealthStatus
from app.routers import a_share, ai_analysis, kline, market, tick_monitor
from app.services.data_updater import data_updater, test_icbc_update
from app.services.kline_initializer import kline_initializer
from app.services.kline_scheduler import kline_scheduler
from app.services.stock_basic_manager import stock_basic_manager
from app.services.stock_initializer import stock_initializer
from app.services.tick_scheduler import tick_scheduler
from app.services.tick_monitor import tick_monitor
from app.services.tick_redis_cache import tick_redis_cache

API_V1_PREFIX = "/api/v1"


def should_run_realtime_update(
    is_trading_time: bool,
    only_during_trading_hours: bool,
    skip_during_trading_hours: bool,
) -> bool:
    """Determine whether realtime scheduler should execute this iteration.

    Priority:
    1. If only-during-trading is enabled, run only when market is trading.
    2. Otherwise, honor the legacy skip-during-trading switch.
    3. Otherwise, run at all times.
    """
    if only_during_trading_hours:
        return is_trading_time

    if skip_during_trading_hours:
        return not is_trading_time

    return True


def setup_logging():
    """Configure and initialize structured logging for the application.

    The configuration is driven by ``settings.LOG_FORMAT`` and ``settings.LOG_LEVEL``.
    The function sets up ``structlog`` processors and binds the standard library
    logging level.
    """
    def reorder_log_fields(_, __, event_dict):
        """Keep key order stable for readability in JSON logs."""
        preferred_order = (
            "event",
            "logger",
            "level",
            "timestamp",
            "method",
            "path",
            "status_code",
            "client_ip",
            "duration_ms",
            "version",
            "debug",
            "check_interval",
            "update_time",
            "iteration",
            "symbols",
            "success_count",
            "error",
        )
        reordered = {}

        for key in preferred_order:
            if key in event_dict:
                reordered[key] = event_dict[key]

        for key, value in event_dict.items():
            if key not in reordered:
                reordered[key] = value

        return reordered

    shared_processors = [
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        reorder_log_fields,
    ]
    renderer = (
        structlog.processors.JSONRenderer()
        if settings.LOG_FORMAT == "json"
        else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))

    # Route uvicorn/error/asgi logs through root formatter.
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.asgi"):
        uv_logger = logging.getLogger(logger_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True

    # Disable Uvicorn's default plain-text access log to avoid mixed formats.
    # We emit structured health-check access logs via middleware below.
    uvicorn_access_logger = logging.getLogger("uvicorn.access")
    uvicorn_access_logger.handlers.clear()
    uvicorn_access_logger.propagate = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Async context manager for FastAPI application lifespan events.

    This manages startup and shutdown tasks such as initializing the
    database connection, performing data initialization routines, and
    launching background scheduler tasks. During shutdown it ensures the
    realtime update task is cancelled and the database pool is closed.

    Args:
        app: The FastAPI application instance.

    Yields:
        None: control is yielded back to FastAPI while the application runs.
    """
    # Startup
    setup_logging()
    logger = structlog.get_logger()
    logger.info(
        "Starting Koduck Data Service",
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )
    
    # Initialize database
    logger.info("Initializing database connection...")
    await Database.get_pool()

    # Initialize A-share stock basic data (enhanced with CSV caching)
    logger.info("Initializing A-share stock basic data with CSV caching...")
    stock_basic_table_exists = await stock_initializer.check_table_exists()
    if stock_basic_table_exists:
        stock_basic_success = await stock_basic_manager.initialize()
    else:
        logger.warning(
            "stock_basic table not ready yet, skipping CSV manager initialization "
            "and waiting for retry initializer"
        )
        stock_basic_success = False
    if stock_basic_success:
        logger.info("Stock basic data initialization from CSV: SUCCESS")
    else:
        logger.warning("Stock basic data initialization from CSV: FAILED, falling back to basic initializer...")
        # Fallback to basic initializer
        init_success = await stock_initializer.run()
        if init_success:
            logger.info("Basic stock initializer: SUCCESS")
        else:
            logger.warning("Basic stock initializer: SKIPPED or FAILED (will retry on next startup)")

    # Initialize K-line data from local CSV files
    logger.info("Initializing K-line data from local files...")
    kline_init_success = await kline_initializer.run()
    if kline_init_success:
        logger.info("K-line data initialization: SUCCESS")
    else:
        logger.warning("K-line data initialization: SKIPPED or FAILED (will retry on next startup)")

    # Start K-line scheduler for automatic updates
    logger.info("Starting K-line scheduler...")
    await kline_scheduler.start()
    
    # Start tick scheduler for maintenance tasks
    if settings.TICK_HISTORY_ENABLED:
        logger.info("Starting tick scheduler...")
        await tick_scheduler.start()
        
        # Start tick monitor for health monitoring
        if getattr(settings, 'TICK_MONITOR_ENABLED', True):
            logger.info("Starting tick monitor...")
            await tick_monitor.start()
        
        # Connect to Redis for tick caching
        try:
            logger.info("Connecting to Redis for tick caching...")
            await tick_redis_cache.connect()
            logger.info("Redis connection: SUCCESS")
        except Exception as e:
            logger.warning(f"Redis connection: FAILED ({e})")
    
    # Start realtime data update task (update stocks with kline data)
    logger.info("Starting realtime stock data update task (watchlist only)...")
    realtime_task = asyncio.create_task(run_realtime_update_scheduler())
    
    yield
    
    # Shutdown
    logger.info("Shutting down Koduck Data Service")
    
    # Stop K-line scheduler
    await kline_scheduler.stop()
    
    # Stop tick scheduler and monitor
    if settings.TICK_HISTORY_ENABLED:
        await tick_scheduler.stop()
        if getattr(settings, 'TICK_MONITOR_ENABLED', True):
            await tick_monitor.stop()
        await tick_redis_cache.close_cache()
    
    realtime_task.cancel()
    try:
        await realtime_task
    except asyncio.CancelledError:
        await Database.close()
        raise
    else:
        await Database.close()


async def run_realtime_update_scheduler():
    """Periodically update stock records from user watchlist.

    The coroutine waits briefly for the service to start, queries the
    database for symbols with daily k-line data, performs an initial
    update for each symbol, and then delegates to
    :func:`app.services.data_updater.run_realtime_loop` for ongoing
    polling every 30 seconds.
    
    By default updates run only during A-share trading sessions
    (09:15-11:30, 13:00-15:00). Legacy mode can still skip updates during
    trading hours via ``REALTIME_SKIP_DURING_TRADING_HOURS`` when
    ``REALTIME_ONLY_DURING_TRADING_HOURS`` is disabled.
    """
    from app.utils.trading_hours import is_a_share_trading_time
    
    logger = structlog.get_logger()
    
    # Wait a bit for service to fully start
    await asyncio.sleep(5)

    from app.db import Database

    def normalize_symbol(value: object) -> str:
        text = str(value).strip()
        if text.endswith(".0"):
            text = text[:-2]
        return text.zfill(6) if text.isdigit() else text

    last_symbols: set[str] = set()
    iteration = 0
    interval_seconds = 30

    logger.info("Starting realtime watchlist scheduler loop")

    while True:
        try:
            is_trading_time = is_a_share_trading_time()
            should_run = should_run_realtime_update(
                is_trading_time=is_trading_time,
                only_during_trading_hours=settings.REALTIME_ONLY_DURING_TRADING_HOURS,
                skip_during_trading_hours=settings.REALTIME_SKIP_DURING_TRADING_HOURS,
            )

            if not should_run:
                logger.debug(
                    "Skipping realtime update by strategy",
                    is_trading_time=is_trading_time,
                    only_during_trading_hours=settings.REALTIME_ONLY_DURING_TRADING_HOURS,
                    skip_during_trading_hours=settings.REALTIME_SKIP_DURING_TRADING_HOURS,
                )
                await asyncio.sleep(interval_seconds)
                continue

            symbols_result = await Database.fetch(
                """
                SELECT DISTINCT symbol
                FROM watchlist_items
                WHERE market IN ('AShare', 'SSE', 'SZSE')
                  AND symbol IS NOT NULL
                  AND btrim(symbol) <> ''
                ORDER BY symbol
                """
            )

            symbols = []
            for row in symbols_result:
                normalized = normalize_symbol(row["symbol"])
                # Keep only A-share numeric symbols for realtime updater.
                if normalized.isdigit() and len(normalized) == 6:
                    symbols.append(normalized)
            current_symbols = set(symbols)

            if current_symbols != last_symbols:
                logger.info(
                    "Watchlist symbols changed: previous=%s, current=%s",
                    len(last_symbols),
                    len(current_symbols),
                )
                last_symbols = current_symbols

            if not symbols:
                logger.info("No watchlist symbols found for realtime update, waiting")
                await asyncio.sleep(interval_seconds)
                continue

            iteration += 1
            success_count = await data_updater._update_symbols_batch(symbols)
            tick_success, tick_failed = await data_updater.flush_remaining_ticks()
            logger.info(
                "[%s] Watchlist realtime update completed: %s/%s symbols, tick_flushed=%s, tick_flush_failed=%s",
                iteration,
                success_count,
                len(symbols),
                tick_success,
                tick_failed,
            )

        except asyncio.CancelledError:
            logger.info("Realtime watchlist scheduler cancelled")
            await data_updater.flush_remaining_ticks()
            raise
        except Exception:
            logger.error("Realtime watchlist scheduler error", exc_info=True)

        await asyncio.sleep(interval_seconds)


async def run_icbc_scheduler():
    """Legacy scheduler that drives ICBC-specific update logic.

    This function exists for backward compatibility. It waits for startup,
    performs a single test update via ``test_icbc_update`` and, if
    successful, enters a loop that invokes
    ``data_updater.run_icbc_test`` every ten seconds for one hour.
    """
    logger = structlog.get_logger()
    
    # Wait a bit for service to fully start
    await asyncio.sleep(5)
    
    # Run initial test
    logger.info("Running ICBC initial test...")
    success = await test_icbc_update()
    
    if success:
        logger.info("ICBC initial test: PASSED")
        # Start continuous update loop (every 10 seconds)
        await data_updater.run_icbc_test(duration_seconds=3600, interval_seconds=10)
    else:
        logger.error("ICBC initial test: FAILED")


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application instance.

    This function sets metadata such as title and version, applies the
    lifespan context manager, mounts middleware (GZip and CORS), and
    registers API routers with a common prefix.

    Returns:
        A fully configured :class:`FastAPI` instance ready to be served.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        description="Quantitative trading data service for multiple markets",
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )
    
    # Add middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(a_share.router, prefix=API_V1_PREFIX)
    app.include_router(ai_analysis.router, prefix=API_V1_PREFIX)
    app.include_router(kline.router, prefix=API_V1_PREFIX)
    app.include_router(market.router, prefix=API_V1_PREFIX)
    app.include_router(tick_monitor.router, prefix=API_V1_PREFIX)

    @app.middleware("http")
    async def log_healthcheck_requests(request, call_next):
        """Emit structured JSON access logs for health checks."""
        started_at = perf_counter()
        response = await call_next(request)

        if request.url.path == "/health":
            logger = structlog.get_logger("app.access")
            logger.info(
                "Health check request",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                client_ip=request.client.host if request.client else None,
                duration_ms=round((perf_counter() - started_at) * 1000, 2),
            )

        return response
    
    return app


# Create the application instance
app = create_app()


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch-all exception handler that returns JSON error responses.

    Logs the unhandled exception and returns a generic 500 response wrapped
    in :class:`~app.models.schemas.ApiResponse`.

    Args:
        request: Incoming request object (FastAPI starlette request).
        exc: The exception instance that was raised.

    Returns:
        :class:`fastapi.responses.JSONResponse` with HTTP 500 status.
    """
    logger = structlog.get_logger()
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content=ApiResponse(
            code=500,
            message="Internal server error",
            data=None,
        ).model_dump(),
    )


@app.get("/", response_model=ApiResponse[dict])
async def root():
    """Health/info endpoint at the application root.

    Returns application name, version, and documentation URL (conditionally
    enabled in debug mode).
    """
    return ApiResponse(
        data={
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs" if settings.DEBUG else None,
        }
    )


@app.get("/health", response_model=ApiResponse[HealthStatus])
async def health_check():
    """Simple liveness check endpoint.

    Returns a :class:`HealthStatus` object containing ``status`` and
    ``version`` fields.  Intended to be used by load balancers or
    container orchestrators.
    """
    return ApiResponse(
        data=HealthStatus(
            status="ok",
            version=settings.APP_VERSION,
        )
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
