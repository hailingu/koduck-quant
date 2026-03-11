"""K-line data initializer.

This module handles importing local CSV files containing K-line data into the
PostgreSQL database during service startup.  It supports on-demand
initialization as well as a background retry loop when the target table is not
yet available.
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import TypedDict

import pandas as pd
import structlog

from app.db import Database

logger = structlog.get_logger(__name__)

# 数据存储根目录
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"


class ImportResult(TypedDict):
    """Result payload for importing one CSV file."""

    file: str
    success: bool
    imported: int
    skipped: int
    error: str | None


class KlineInitializer:
    """Initialize K-line dataset from CSV."""
    
    def __init__(self) -> None:
        """初始化"""
        self._initialized = False
        self._retry_interval = 30  # 重试间隔（秒）
        self._retry_task: asyncio.Task[None] | None = None
    
    async def check_table_exists(self) -> bool:
        """Return ``True`` if the ``kline_data`` table exists in the database.

        Queries ``information_schema.tables`` to confirm the presence of the
        table.  Any errors during the check are logged and ``False`` is
        returned.
        """
        try:
            result = await Database.fetchrow(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'kline_data'
                )
                """
            )
            return bool(result and result.get("exists", False))
        except Exception:
            logger.warning("Failed to check table existence", exc_info=True)
            return False
    
    async def check_needs_initialization(self) -> bool:
        """Determine whether a fresh import is required.

        The method returns ``True`` when the table is empty or contains no data
        from the last seven days.  If the table does not yet exist it logs a
        warning and returns ``False`` (pending schema migration).

        Returns:
            ``True`` if initialization should run, ``False`` otherwise.
        """
        if not await self.check_table_exists():
            logger.warning(
                "kline_data table does not exist yet, waiting for Backend "
                "Flyway migration"
            )
            return False
        
        try:
            result = await Database.fetchrow(
                "SELECT COUNT(*) as count FROM kline_data"
            )
            count = result["count"] if result else 0
            
            if count == 0:
                logger.info("kline_data table is empty, needs initialization")
                return True

            # Validate CSV coverage to avoid treating partial imports as complete.
            csv_files = self.find_csv_files()
            if csv_files:
                expected_pairs = {
                    (self._normalize_symbol(path.stem), self.detect_timeframe(path))
                    for path in csv_files
                }
                expected_count = len(expected_pairs)
                pair_result = await Database.fetchrow(
                    """
                    SELECT COUNT(*) AS count
                    FROM (
                        SELECT DISTINCT symbol, timeframe
                        FROM kline_data
                        WHERE market = 'AShare'
                    ) pairs
                    """
                )
                actual_count = pair_result["count"] if pair_result else 0

                if actual_count < expected_count:
                    logger.warning(
                        "kline_data coverage incomplete: %s/%s symbol-timeframe pairs, needs initialization",
                        actual_count,
                        expected_count,
                    )
                    return True
            
            # 检查是否有最近的数据（7天内）
            recent = await Database.fetchrow("""
                SELECT COUNT(*) as count FROM kline_data 
                WHERE kline_time >= NOW() - INTERVAL '7 days'
            """)
            recent_count = recent["count"] if recent else 0
            
            if recent_count == 0:
                logger.info("kline_data has no recent data (7 days), needs refresh")
                return True
            
            logger.info(
                "kline_data table has %s records, skipping initialization", count
            )
            return False
            
        except Exception:
            logger.error("Failed to check kline_data table", exc_info=True)
            return False
    
    def find_csv_files(self, timeframes: list[str] | None = None) -> list[Path]:
        """Locate CSV files on disk.

        If ``timeframes`` is provided the search is restricted to subdirectories
        named after each timeframe; otherwise every subdirectory under
        :data:`DATA_DIR` is scanned.

        Returns:
            A list of :class:`pathlib.Path` objects pointing to discovered CSV
            files.  An empty list is returned if the data directory is missing.
        """
        files = []
        
        if not DATA_DIR.exists():
            logger.warning(f"Data directory does not exist: {DATA_DIR}")
            return files
        
        if timeframes:
            for tf in timeframes:
                tf_dir = DATA_DIR / tf
                if tf_dir.exists():
                    csv_files = list(tf_dir.glob("*.csv"))
                    files.extend(csv_files)
        else:
            # 查找所有目录下的CSV文件
            for tf_dir in DATA_DIR.iterdir():
                if tf_dir.is_dir():
                    csv_files = list(tf_dir.glob("*.csv"))
                    files.extend(csv_files)
        
        return files
    
    def load_csv_data(self, csv_path: Path) -> pd.DataFrame | None:
        """Read a CSV file into a DataFrame.

        Args:
            csv_path: Path to the CSV file.

        Returns:
            ``pandas.DataFrame`` containing the file contents, or ``None`` on
            failure.  Errors are logged.
        """
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
            return df
        except Exception:
            logger.error("Failed to load CSV %s", csv_path, exc_info=True)
            return None
    
    def detect_timeframe(self, csv_path: Path) -> str:
        """Infer timeframe from the CSV file path.

        The parent directory name is used when possible; otherwise the function
        searches the path segments for ``"kline"`` and returns the following
        component.  Defaults to ``"1D"`` if no timeframe can be determined.
        """
        if csv_path.parent.name and csv_path.parent.name != "kline":
            return csv_path.parent.name

        parts = csv_path.parts
        if "kline" in parts:
            idx = parts.index("kline")
            if idx + 1 < len(parts):
                return parts[idx + 1]
        return "1D"

    def _normalize_symbol(self, symbol: object) -> str:
        """Normalize stock symbol to 6-digit code when possible."""
        text = str(symbol).strip()
        if not text:
            return text

        # Handle pandas numeric parsing cases like 2050 or 2050.0
        if text.endswith(".0"):
            text = text[:-2]

        if text.isdigit():
            return text.zfill(6)
        return text

    def _extract_symbol(self, df: pd.DataFrame, csv_path: Path) -> str:
        """Extract symbol from CSV content or fallback to file stem."""
        if "symbol" in df.columns:
            symbols = df["symbol"].unique()
            if len(symbols) > 0:
                return self._normalize_symbol(symbols[0])
        return self._normalize_symbol(csv_path.stem)

    def _extract_kline_time(
        self,
        row: pd.Series,
        timeframe: str,
    ) -> datetime | pd.Timestamp | None:
        """Extract kline timestamp from one row with timeframe validation."""
        parsed_time: datetime | pd.Timestamp | None = None

        is_minute_timeframe = timeframe not in {"1D", "1W", "1M"}
        timestamp_value = row.get("timestamp")

        # Minute data often carries both `datetime` (date-only) and `timestamp`.
        # Prefer epoch timestamp to preserve intraday precision.
        if is_minute_timeframe and timestamp_value is not None and not pd.isna(timestamp_value):
            parsed_time = datetime.fromtimestamp(float(timestamp_value))
        elif "datetime" in row:
            parsed_time = pd.to_datetime(row["datetime"])
        elif "kline_time" in row:
            parsed_time = pd.to_datetime(row["kline_time"])
        elif timestamp_value is not None and not pd.isna(timestamp_value):
            parsed_time = datetime.fromtimestamp(float(timestamp_value))

        if parsed_time is None or pd.isna(parsed_time):
            return None

        if isinstance(parsed_time, pd.Timestamp):
            check_time = parsed_time.to_pydatetime()
        else:
            check_time = parsed_time

        if timeframe in {"1D", "1W", "1M"}:
            if (
                check_time.hour != 0
                or check_time.minute != 0
                or check_time.second != 0
                or check_time.microsecond != 0
            ):
                return None

        return parsed_time

    def _extract_price_fields(
        self, row: pd.Series
    ) -> tuple[float, float, float, float]:
        """Extract OHLC values with fallback aliases."""
        open_price = float(row.get("open", 0) or row.get("open_price", 0) or 0)
        high_price = float(row.get("high", 0) or row.get("high_price", 0) or 0)
        low_price = float(row.get("low", 0) or row.get("low_price", 0) or 0)
        close_price = float(row.get("close", 0) or row.get("close_price", 0) or 0)
        return open_price, high_price, low_price, close_price
    
    async def import_csv_file(
        self, csv_path: Path, batch_size: int = 100
    ) -> ImportResult:
        """Import a single CSV into the database.

        The function reads the file, infers metadata (symbol, timeframe) and
        iterates over rows inserting each kline entry.  Rows that cannot be
        parsed are skipped with a warning.  The entire operation is wrapped in
        a transaction and uses ``ON CONFLICT DO NOTHING`` to avoid duplicates.

        Args:
            csv_path: Path to the CSV file to import.
            batch_size: Currently unused; reserved for future batch logic.

        Returns:
            An :class:`ImportResult` describing success, counts, and any error
            message.
        """
        _ = batch_size
        result: ImportResult = {
            "file": str(csv_path),
            "success": False,
            "imported": 0,
            "skipped": 0,
            "error": None,
        }
        
        df = self.load_csv_data(csv_path)
        if df is None or df.empty:
            result["error"] = "Empty or load failed"
            return result
        
        timeframe = self.detect_timeframe(csv_path)
        symbol = self._extract_symbol(df, csv_path)
        
        logger.info("Importing %s (%s): %s records", symbol, timeframe, len(df))
        
        insert_sql = """
            INSERT INTO kline_data (
                market, symbol, timeframe, kline_time,
                open_price, high_price, low_price, close_price,
                volume, amount, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            ON CONFLICT (market, symbol, timeframe, kline_time) DO NOTHING
        """
        
        try:
            pool = await Database.get_pool()
            imported = 0
            skipped = 0
            
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for _, row in df.iterrows():
                        try:
                            kline_time = self._extract_kline_time(row, timeframe)
                            
                            if kline_time is None:
                                skipped += 1
                                continue

                            open_price, high_price, low_price, close_price = (
                                self._extract_price_fields(row)
                            )
                            
                            await conn.execute(
                                insert_sql,
                                "AShare",
                                symbol,
                                timeframe,
                                kline_time,
                                open_price,
                                high_price,
                                low_price,
                                close_price,
                                int(row.get("volume", 0) or 0),
                                float(row.get("amount", 0) or 0),
                            )
                            imported += 1
                            
                        except Exception:
                            logger.warning("Failed to import row", exc_info=True)
                            skipped += 1
                            continue
            
            result["success"] = True
            result["imported"] = imported
            result["skipped"] = skipped
            logger.info("Imported %s records for %s (%s)", imported, symbol, timeframe)
            
        except Exception as e:
            result["error"] = str(e)
            logger.error("Failed to import %s", csv_path, exc_info=True)
        
        return result
    
    async def initialize(self, timeframes: list[str] | None = None) -> bool:
        """Perform full initialization by importing all CSV files.

        Args:
            timeframes: Optional list of timeframes to filter which files are
                imported.

        Returns:
            ``True`` if every file imported successfully; ``False`` if any file
            failed.
        """
        # 查找CSV文件
        csv_files = self.find_csv_files(timeframes)
        
        if not csv_files:
            logger.warning("No CSV files found to import")
            # 不算失败，可能是首次运行没有数据
            return True
        
        logger.info(f"Found {len(csv_files)} CSV files to import")
        
        total_imported = 0
        total_skipped = 0
        success_count = 0
        failed_count = 0
        
        for csv_file in csv_files:
            result = await self.import_csv_file(csv_file)
            
            if result["success"]:
                success_count += 1
                total_imported += result["imported"]
                total_skipped += result["skipped"]
            else:
                failed_count += 1
        
        logger.info(
            f"K-line initialization completed: "
            f"{success_count} files succeeded, {failed_count} failed, "
            f"{total_imported} records imported, {total_skipped} skipped"
        )
        
        return failed_count == 0
    
    async def run(self, timeframes: list[str] | None = None) -> bool:
        """Execute the initialization workflow.

        This is the entry point used by the application startup logic.  It
        checks for table existence, optionally triggers a background retry
        task, and calls :meth:`initialize` when needed.

        Args:
            timeframes: See :meth:`initialize`.

        Returns:
            ``True`` if the initialization completed (or was unnecessary),
            ``False`` if it was deferred due to missing schema.
        """
        try:
            # 检查表是否存在
            if not await self.check_table_exists():
                logger.warning(
                    "kline_data table does not exist yet. "
                    "Waiting for Backend Flyway migration..."
                )
                self._ensure_retry_task(timeframes)
                return False
            
            # 检查是否需要初始化
            if not await self.check_needs_initialization():
                logger.info("K-line data already exists and is up to date")
                self._initialized = True

                # Notify scheduler even when initialization is skipped.
                # Otherwise scheduler remains in INITIALIZING forever.
                from app.services.kline_scheduler import kline_scheduler
                await kline_scheduler.mark_initialization_complete()
                return True
            
            # 执行初始化
            success = await self.initialize(timeframes)
            
            if success:
                self._initialized = True
                logger.info("K-line data initialization completed successfully")
                
                # Notify scheduler that initialization is complete
                from app.services.kline_scheduler import kline_scheduler
                await kline_scheduler.mark_initialization_complete()
            
            return success
            
        except Exception:
            logger.error("K-line initialization error", exc_info=True)
            return False
    
    def _ensure_retry_task(self, timeframes: list[str] | None = None) -> None:
        """Make sure the background retry task is only created once.

        Subsequent calls while the previous task is still running are ignored.
        """
        if self._retry_task is not None and not self._retry_task.done():
            return
        self._retry_task = asyncio.create_task(self._retry_initialization(timeframes))

    async def _retry_initialization(self, timeframes: list[str] | None = None) -> None:
        """Background loop that retries initialization until success.

        This coroutine sleeps for ``self._retry_interval`` seconds between
        attempts and stops once :attr:`_initialized` becomes ``True``.
        """
        logger.info(
            "Starting background retry loop (interval: %ss)", self._retry_interval
        )
        
        while not self._initialized:
            await asyncio.sleep(self._retry_interval)
            
            try:
                if await self.check_table_exists():
                    logger.info(
                        "kline_data table now exists, starting initialization..."
                    )
                    success = await self.run(timeframes)
                    if success:
                        self._initialized = True
                        logger.info(
                            "Background kline initialization completed successfully"
                        )
                        break
                else:
                    logger.debug("kline_data table still does not exist, will retry...")
                    
            except Exception:
                logger.error("Error in background retry", exc_info=True)


# 全局实例
kline_initializer = KlineInitializer()
