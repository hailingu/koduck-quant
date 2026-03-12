"""Stock basic data initializer for A-share market.

This module is responsible for initializing stock basic information
(stock code, name, market, board) on first startup.
"""

import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, TypedDict

import akshare as ak
import pandas as pd
import structlog

from app.config import settings
from app.db import Database, StockRealtimeDB

logger = structlog.get_logger(__name__)
FETCH_ATTEMPT_MESSAGE = "Attempting to fetch A-share stock list via %s..."


class StockBasicRecord(TypedDict):
    """Stock basic record used for database initialization."""

    symbol: str
    name: str
    market: str
    board: str
    created_at: datetime
    updated_at: datetime


# Stock code ranges for market and board classification
# Format: (start, end, market, board)
STOCK_RANGES: list[tuple[int, int, str, str]] = [
    # Shanghai Stock Exchange (SSE)
    (600000, 603999, "SSE", "Main"),  # 
    (688000, 688999, "SSE", "STAR"),  # 
    # Shenzhen Stock Exchange (SZSE)
    (0, 3999, "SZSE", "Main"),  # 
    (300000, 303999, "SZSE", "ChiNext"),  # 
    # Beijing Stock Exchange (BSE)
    (430001, 899999, "BSE", "BSE"),  # 
]


def classify_stock(symbol: str) -> tuple[str, str]:
    """Classify stock by symbol code.

    Args:
        symbol: Stock symbol (e.g., '600000', '000001', '300001')

    Returns:
        Tuple of (market, board)
    """
    try:
        # Convert symbol to integer (pad with leading zeros if needed)
        code_int = int(symbol)

        for start, end, market, board in STOCK_RANGES:
            if start <= code_int <= end:
                return market, board

        # Default classification
        return "Unknown", "Unknown"

    except (ValueError, TypeError):
        return "Unknown", "Unknown"


class StockInitializer:
    """Stock basic data initializer."""

    def __init__(self) -> None:
        """Initialize the stock initializer."""
        self.batch_size = 100  # Batch insert size
        self._initialized = False
        self._retry_interval = 30  # Retry every 30 seconds if table not exists
        self._api_max_retries = 3  # Max retries per API
        self._api_retry_base_delay = 2
        self._retry_task: asyncio.Task[None] | None = None

    async def check_table_exists(self) -> bool:
        """Check if stock_basic table exists.

        Returns:
            True if table exists
        """
        try:
            result = await Database.fetchrow(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'stock_basic'
                )
                """
            )
            return bool(result and result.get("exists", False))
        except Exception as e:
            logger.warning(f"Failed to check table existence: {e}")
            return False

    async def check_needs_initialization(self) -> bool:
        """Check if stock_basic table needs initialization.

        Returns:
            True if table is empty or needs update
        """
        # First check if table exists
        if not await self.check_table_exists():
            logger.warning(
                "stock_basic table does not exist yet, waiting for Flyway migration"
            )
            return False

        try:
            result = await Database.fetchrow(
                "SELECT COUNT(*) as count FROM stock_basic"
            )
            count = result["count"] if result else 0

            if count == 0:
                logger.info("stock_basic table is empty, needs initialization")
                return True

            if count < settings.STOCK_BASIC_MIN_COUNT:
                logger.warning(
                    "stock_basic table has only %s records (< %s), continuing initialization",
                    count,
                    settings.STOCK_BASIC_MIN_COUNT,
                )
                return True

            logger.info(
                "stock_basic table has %s records, skipping initialization",
                count,
            )
            return False

        except Exception as e:
            logger.error(f"Failed to check stock_basic table: {e}")
            return False

    async def _fetch_with_retry(
        self,
        fetch_func: Callable[..., pd.DataFrame],
        *args: Any,
        **kwargs: Any,
    ) -> pd.DataFrame | None:
        """Execute a fetch function with exponential backoff retry.

        Args:
            fetch_func: The function to call
            *args: Positional arguments for fetch_func
            **kwargs: Keyword arguments for fetch_func

        Returns:
            DataFrame if successful, None if failed after retries
        """
        last_exception: Exception | None = None

        for attempt in range(self._api_max_retries):
            try:
                df = fetch_func(*args, **kwargs)
                if df is not None and not df.empty:
                    return df

                if attempt < self._api_max_retries - 1:
                    delay = self._api_retry_base_delay * (2**attempt)
                    logger.warning(
                        "API returned empty data, retrying in %ss (attempt %s/%s)",
                        delay,
                        attempt + 1,
                        self._api_max_retries,
                    )
                    await asyncio.sleep(delay)

            except Exception as e:
                last_exception = e
                if attempt < self._api_max_retries - 1:
                    delay = self._api_retry_base_delay * (2**attempt)
                    logger.warning(
                        "API failed: %s, retrying in %ss (attempt %s/%s)",
                        e,
                        delay,
                        attempt + 1,
                        self._api_max_retries,
                    )
                    await asyncio.sleep(delay)

        if last_exception:
            logger.error(f"All retries exhausted, last error: {last_exception}")
        else:
            logger.error("All retries exhausted, API returned empty data")

        return None

    async def fetch_a_share_stocks(self) -> list[StockBasicRecord]:
        """Fetch all A-share stock basic information.

        Returns:
            List of stock basic info dictionaries

        Note:
            This method will NOT use hardcoded fallback. If all external APIs fail,
            it returns an empty list and relies on background retry to populate data.
        """
        fetch_methods: list[Callable[[], Awaitable[list[StockBasicRecord]]]] = [
            self._fetch_from_method_one,
            self._fetch_from_method_two,
            self._fetch_from_method_three,
        ]

        for fetch_method in fetch_methods:
            stocks = await fetch_method()
            if stocks:
                return stocks

        # IMPORTANT: Do NOT use hardcoded fallback!
        # If all external APIs fail, do not populate incomplete stock data.
        # The background retry mechanism will keep trying to fetch data.
        logger.error(
            "ALL external APIs failed to fetch stock list. "
            "NOT using hardcoded fallback (36 stocks is insufficient for search). "
            "Will retry in background. "
            "Please check network connectivity and API availability."
        )

        return []

    def _try_process_result(
        self,
        df: pd.DataFrame | None,
        source_name: str,
        code_column: str,
        name_column: str,
    ) -> list[StockBasicRecord]:
        """Process fetched raw dataframe into stock records."""
        if df is None or df.empty:
            logger.warning("%s failed after retries", source_name)
            return []

        logger.info("Fetched %s stocks from %s", len(df), source_name)
        try:
            normalized_df = df[[code_column, name_column]].reset_index(drop=True)
            normalized_df = normalized_df.rename(
                columns={code_column: "symbol", name_column: "name"}
            )
            stocks = self._process_stock_data(normalized_df)
            if stocks:
                logger.info(
                    "Successfully processed %s stocks from %s",
                    len(stocks),
                    source_name,
                )
            return stocks
        except Exception as e:
            logger.error("Failed to process %s data: %s", source_name, e)
            return []

    async def _fetch_from_method_one(self) -> list[StockBasicRecord]:
        """Fetch stock list from AKShare `stock_info_a_code_name`."""
        source = "AKShare stock_info_a_code_name"
        logger.info(FETCH_ATTEMPT_MESSAGE, source)
        df = await self._fetch_with_retry(ak.stock_info_a_code_name)
        return self._try_process_result(df, source, "code", "name")

    async def _fetch_from_method_two(self) -> list[StockBasicRecord]:
        """Fetch stock list from AKShare `stock_zh_a_spot_em`."""
        source = "AKShare stock_zh_a_spot_em"
        logger.info(FETCH_ATTEMPT_MESSAGE, source)
        df = await self._fetch_with_retry(ak.stock_zh_a_spot_em)
        return self._try_process_result(df, source, "代码", "名称")

    async def _fetch_from_method_three(self) -> list[StockBasicRecord]:
        """Fetch stock list from Eastmoney client."""
        source = "Eastmoney client"
        logger.info(FETCH_ATTEMPT_MESSAGE, source)
        try:
            from app.services.eastmoney_client import eastmoney_client

            df = await self._fetch_with_retry(eastmoney_client.fetch_stock_list)
            return self._try_process_result(df, source, "代码", "名称")
        except Exception as e:
            logger.error("Failed to import or use %s: %s", source, e)
            return []

    def _process_stock_data(self, df: pd.DataFrame) -> list[StockBasicRecord]:
        """Process stock data and add market/board classification.

        Args:
            df: DataFrame with 'symbol' and 'name' columns

        Returns:
            List of processed stock dictionaries
        """
        stocks: list[StockBasicRecord] = []
        now = datetime.now(timezone.utc)  # noqa: UP017

        for _, row in df.iterrows():
            try:
                symbol = str(row["symbol"]).strip()
                name = str(row["name"]).strip()

                if not symbol or not name:
                    continue

                # Classify market and board
                market, board = classify_stock(symbol)

                stocks.append(
                    {
                        "symbol": symbol,
                        "name": name,
                        "market": market,
                        "board": board,
                        "created_at": now,
                        "updated_at": now,
                    }
                )

            except Exception as e:
                logger.warning(f"Failed to process stock row: {e}")
                continue

        logger.info("Processed %s stocks with market/board classification", len(stocks))
        return stocks

    async def _check_column_exists(self, column_name: str) -> bool:
        """Check if a column exists in stock_basic table."""
        try:
            result = await Database.fetchrow(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'stock_basic' AND column_name = $1
                )
                """,
                column_name,
            )
            return bool(result and result.get("exists", False))
        except Exception:
            return False

    async def initialize_stocks(self, stocks: list[StockBasicRecord]) -> int:
        """Initialize stock basic data into database.

        Args:
            stocks: List of stock dictionaries

        Returns:
            Number of stocks inserted
        """
        if not stocks:
            logger.warning("No stocks to initialize")
            return 0

        inserted_count = 0

        try:
            # Check if enhanced columns exist (for backwards compatibility)
            has_full_name_column = await self._check_column_exists("full_name")
            has_board_column = await self._check_column_exists("board")

            if has_full_name_column:
                # Use enhanced insert with all columns via StockRealtimeDB
                logger.info("Using enhanced stock basic insert with full details")
                for stock in stocks:
                    # Convert StockBasicRecord to full detail format
                    data = {
                        'symbol': stock["symbol"],
                        'name': stock["name"],
                        'full_name': None,  # Not available in basic fetch
                        'short_name': stock["name"],
                        'market': stock["market"],
                        'board': stock["board"],
                        'industry': None,
                        'sector': None,
                        'sub_industry': None,
                        'province': None,
                        'city': None,
                        'total_shares': None,
                        'float_shares': None,
                        'float_ratio': None,
                        'status': 'Active',
                        'is_shanghai_hongkong': False,
                        'is_shenzhen_hongkong': False,
                        'stock_type': 'A',
                        'list_date': None,
                        'pe_ttm': None,
                        'pb': None,
                        'ps_ttm': None,
                        'market_cap': None,
                        'float_market_cap': None,
                    }
                    success = await StockRealtimeDB.upsert_stock_basic_full(data)
                    if success:
                        inserted_count += 1
                    
                    if inserted_count % 500 == 0:
                        logger.info(
                            "Initialized %s/%s stocks...",
                            inserted_count,
                            len(stocks),
                        )
            elif has_board_column:
                # Use basic insert with board column
                logger.info("Using basic insert with board column")
                insert_sql = """
                    INSERT INTO stock_basic (
                        symbol, name, market, board, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (symbol) DO UPDATE SET
                        name = EXCLUDED.name,
                        market = EXCLUDED.market,
                        board = EXCLUDED.board,
                        updated_at = EXCLUDED.updated_at
                """
                
                pool = await Database.get_pool()
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        for stock in stocks:
                            await conn.execute(
                                insert_sql,
                                stock["symbol"],
                                stock["name"],
                                stock["market"],
                                stock["board"],
                                stock["created_at"],
                                stock["updated_at"],
                            )
                            inserted_count += 1

                            if inserted_count % 500 == 0:
                                logger.info(
                                    "Initialized %s/%s stocks...",
                                    inserted_count,
                                    len(stocks),
                                )
            else:
                # Fallback: insert without board column
                logger.warning("board column not found, inserting without board data")
                insert_sql = """
                    INSERT INTO stock_basic (
                        symbol, name, market, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (symbol) DO UPDATE SET
                        name = EXCLUDED.name,
                        market = EXCLUDED.market,
                        updated_at = EXCLUDED.updated_at
                """
                
                pool = await Database.get_pool()
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        for stock in stocks:
                            await conn.execute(
                                insert_sql,
                                stock["symbol"],
                                stock["name"],
                                stock["market"],
                                stock["created_at"],
                                stock["updated_at"],
                            )
                            inserted_count += 1

                            if inserted_count % 500 == 0:
                                logger.info(
                                    "Initialized %s/%s stocks...",
                                    inserted_count,
                                    len(stocks),
                                )

            logger.info(f"Successfully initialized {inserted_count} stocks")
            return inserted_count

        except Exception as e:
            logger.error(f"Failed to initialize stocks: {e}")
            return inserted_count

    async def run(self) -> bool:
        """Run the stock initialization process.

        If table doesn't exist, will retry in background.

        Returns:
            True if initialization was successful
        """
        try:
            # Check if table exists first
            if not await self.check_table_exists():
                logger.warning(
                    "stock_basic table does not exist yet. "
                    "Waiting for Backend Flyway migration..."
                )
                # Start background retry task
                self._ensure_retry_task()
                return False

            # Check if initialization is needed
            if not await self.check_needs_initialization():
                logger.info("Stock basic data already exists, skipping initialization")
                return True

            # Fetch A-share stocks
            logger.info("Starting stock basic data initialization...")
            stocks = await self.fetch_a_share_stocks()

            if not stocks:
                logger.error("No stocks fetched, initialization failed")
                # Start background retry task to keep trying
                if not self._initialized:
                    self._ensure_retry_task()
                return False

            # Initialize stocks into database
            inserted_count = await self.initialize_stocks(stocks)

            if inserted_count > 0:
                logger.info(f"Stock initialization completed: {inserted_count} stocks")
                self._initialized = True
                return True
            else:
                logger.error("Stock initialization failed: no stocks inserted")
                return False

        except Exception as e:
            logger.error(f"Stock initialization error: {e}")
            return False

    def _ensure_retry_task(self) -> None:
        """Create retry task once and keep its reference alive."""
        if self._retry_task is None or self._retry_task.done():
            self._retry_task = asyncio.create_task(self._retry_initialization())

    async def _handle_retry_cycle(self, retry_count: int) -> bool:
        """Handle one retry cycle.

        Args:
            retry_count: Current retry index (1-based).

        Returns:
            True when retry loop should stop, otherwise False.
        """
        if not await self.check_table_exists():
            logger.debug(
                "Background retry %s: stock_basic table still does not exist",
                retry_count,
            )
            return False

        if not await self.check_needs_initialization():
            logger.info("stock_basic table now has data, initialization successful")
            self._initialized = True
            return True

        logger.info(
            "Background retry %s: attempting initialization...",
            retry_count,
        )
        success = await self.run()
        if success:
            self._initialized = True
            logger.info("Background initialization completed successfully")
            return True

        logger.warning(
            "Background retry %s: initialization failed, will retry...",
            retry_count,
        )
        return False

    async def _retry_initialization(self) -> None:
        """Retry initialization in background until success or retry limit."""
        logger.info(
            "Starting background retry loop (interval: %ss)",
            self._retry_interval,
        )

        max_background_retries = 10  # Limit background retries to avoid infinite loop
        for retry_count in range(1, max_background_retries + 1):
            if self._initialized:
                break

            await asyncio.sleep(self._retry_interval)

            try:
                should_stop = await self._handle_retry_cycle(retry_count)
                if should_stop:
                    break

            except Exception as e:
                logger.error(f"Error in background retry {retry_count}: {e}")

        if not self._initialized:
            logger.error(
                "Background retry limit (%s) reached, giving up",
                max_background_retries,
            )


# Global instance
stock_initializer = StockInitializer()
