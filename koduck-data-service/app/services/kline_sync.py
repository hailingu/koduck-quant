"""K-line CSV to Database synchronization service.

This module provides functionality to synchronize local CSV files with the
PostgreSQL database, ensuring data consistency between the file cache and
the database.
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import TypedDict

import pandas as pd
import structlog

from app.db import Database

logger = structlog.get_logger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"


class SyncResult(TypedDict):
    """Result of synchronizing one CSV file."""

    file: str
    symbol: str
    timeframe: str
    success: bool
    imported: int
    skipped: int
    error: str | None


class KlineSync:
    """Synchronize K-line CSV files with database.
    
    This service compares CSV files with database records and imports
    any missing or updated data.
    """

    def __init__(self) -> None:
        """Initialize the sync service."""
        self._sync_stats = {
            "last_sync": None,
            "files_processed": 0,
            "records_imported": 0,
        }

    def find_csv_files(self, timeframes: list[str] | None = None) -> list[Path]:
        """Find all CSV files in the data directory."""
        files = []
        
        if not DATA_DIR.exists():
            logger.warning(f"Data directory does not exist: {DATA_DIR}")
            return files
        
        if timeframes:
            for tf in timeframes:
                tf_dir = DATA_DIR / tf
                if tf_dir.exists():
                    files.extend(tf_dir.glob("*.csv"))
        else:
            for tf_dir in DATA_DIR.iterdir():
                if tf_dir.is_dir():
                    files.extend(tf_dir.glob("*.csv"))
        
        return files

    def load_csv_data(self, csv_path: Path) -> pd.DataFrame | None:
        """Load CSV file into DataFrame."""
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
            return df
        except Exception:
            logger.error("Failed to load CSV %s", csv_path, exc_info=True)
            return None

    def detect_timeframe(self, csv_path: Path) -> str:
        """Detect timeframe from file path."""
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

        # Handle pandas numeric parsing cases like 2885 or 2885.0
        if text.endswith(".0"):
            text = text[:-2]

        if text.isdigit():
            return text.zfill(6)
        return text

    def _extract_symbol(self, df: pd.DataFrame, csv_path: Path) -> str:
        """Extract symbol from CSV or filename."""
        if "symbol" in df.columns:
            symbols = df["symbol"].unique()
            if len(symbols) > 0:
                return self._normalize_symbol(symbols[0])
        return self._normalize_symbol(csv_path.stem)

    def _extract_kline_time(self, row: pd.Series) -> datetime | pd.Timestamp | None:
        """Extract kline timestamp from row."""
        if "datetime" in row:
            return pd.to_datetime(row["datetime"])
        if "kline_time" in row:
            return pd.to_datetime(row["kline_time"])
        if "timestamp" in row:
            return datetime.fromtimestamp(row["timestamp"])
        return None

    async def get_db_last_update(self, symbol: str, timeframe: str) -> datetime | None:
        """Get the last update time for a symbol from database."""
        try:
            result = await Database.fetchrow(
                """
                SELECT MAX(kline_time) as last_time 
                FROM kline_data 
                WHERE symbol = $1 AND timeframe = $2
                """,
                symbol,
                timeframe,
            )
            return result["last_time"] if result and result["last_time"] else None
        except Exception:
            logger.warning("Failed to get last update time", exc_info=True)
            return None

    async def get_csv_date_range(self, df: pd.DataFrame) -> tuple[datetime, datetime] | None:
        """Get date range from CSV DataFrame."""
        try:
            if "datetime" in df.columns:
                times = pd.to_datetime(df["datetime"])
                return times.min(), times.max()
            if "timestamp" in df.columns:
                times = pd.to_datetime(df["timestamp"], unit="s")
                return times.min(), times.max()
            return None
        except Exception:
            return None

    async def sync_csv_file(
        self,
        csv_path: Path,
        force: bool = False,
    ) -> SyncResult:
        """Synchronize a single CSV file with database.
        
        Args:
            csv_path: Path to CSV file
            force: If True, re-import all data even if exists
            
        Returns:
            SyncResult with statistics
        """
        result: SyncResult = {
            "file": str(csv_path),
            "symbol": "",
            "timeframe": "",
            "success": False,
            "imported": 0,
            "skipped": 0,
            "error": None,
        }

        df = self.load_csv_data(csv_path)
        if df is None or df.empty:
            result["error"] = "Empty or failed to load"
            return result

        timeframe = self.detect_timeframe(csv_path)
        symbol = self._extract_symbol(df, csv_path)
        result["symbol"] = symbol
        result["timeframe"] = timeframe

        # Check if sync is needed
        if not force:
            csv_range = await self.get_csv_date_range(df)
            db_last = await self.get_db_last_update(symbol, timeframe)
            
            if csv_range and db_last:
                csv_max = csv_range[1]
                # If database already has data up to CSV max date, skip
                if db_last >= csv_max:
                    logger.debug(
                        "CSV already synced",
                        symbol=symbol,
                        csv_max=csv_max,
                        db_last=db_last,
                    )
                    result["success"] = True
                    result["skipped"] = len(df)
                    return result

        logger.info(
            "Syncing K-line CSV to database",
            symbol=symbol,
            timeframe=timeframe,
            records=len(df),
        )

        insert_sql = """
            INSERT INTO kline_data (
                market, symbol, timeframe, kline_time,
                open_price, high_price, low_price, close_price,
                volume, amount, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            ON CONFLICT (market, symbol, timeframe, kline_time) 
            DO UPDATE SET
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price,
                volume = EXCLUDED.volume,
                amount = EXCLUDED.amount,
                updated_at = NOW()
        """

        try:
            pool = await Database.get_pool()
            imported = 0
            skipped = 0

            async with pool.acquire() as conn:
                async with conn.transaction():
                    for _, row in df.iterrows():
                        try:
                            kline_time = self._extract_kline_time(row)
                            if kline_time is None:
                                skipped += 1
                                continue

                            await conn.execute(
                                insert_sql,
                                "AShare",
                                symbol,
                                timeframe,
                                kline_time,
                                float(row.get("open", 0) or 0),
                                float(row.get("high", 0) or 0),
                                float(row.get("low", 0) or 0),
                                float(row.get("close", 0) or 0),
                                int(row.get("volume", 0) or 0),
                                float(row.get("amount", 0) or 0),
                            )
                            imported += 1

                        except Exception:
                            logger.warning("Failed to sync row", exc_info=True)
                            skipped += 1

            result["success"] = True
            result["imported"] = imported
            result["skipped"] = skipped
            
            self._sync_stats["files_processed"] += 1
            self._sync_stats["records_imported"] += imported
            
            logger.info(
                "CSV sync completed",
                symbol=symbol,
                imported=imported,
                skipped=skipped,
            )

        except Exception as e:
            result["error"] = str(e)
            logger.error("Failed to sync CSV %s", csv_path, exc_info=True)

        return result

    async def sync_all(
        self,
        timeframes: list[str] | None = None,
        symbols: list[str] | None = None,
        force: bool = False,
    ) -> dict:
        """Synchronize all CSV files with database.
        
        Args:
            timeframes: Filter by timeframes
            symbols: Filter by symbols
            force: Force re-import even if exists
            
        Returns:
            Statistics dict
        """
        csv_files = self.find_csv_files(timeframes)
        
        if symbols:
            csv_files = [f for f in csv_files if f.stem in symbols]

        if not csv_files:
            logger.warning("No CSV files found to sync")
            return {
                "total": 0,
                "success": 0,
                "failed": 0,
                "imported": 0,
                "skipped": 0,
                "details": [],
            }

        logger.info(f"Starting K-line sync for {len(csv_files)} files")
        
        results = {
            "total": len(csv_files),
            "success": 0,
            "failed": 0,
            "imported": 0,
            "skipped": 0,
            "details": [],
        }

        for csv_file in csv_files:
            result = await self.sync_csv_file(csv_file, force)
            results["details"].append(result)
            
            if result["success"]:
                results["success"] += 1
                results["imported"] += result["imported"]
                results["skipped"] += result["skipped"]
            else:
                results["failed"] += 1

        self._sync_stats["last_sync"] = datetime.now()
        
        logger.info(
            "K-line sync completed",
            total=results["total"],
            success=results["success"],
            failed=results["failed"],
            imported=results["imported"],
        )

        return results

    def get_stats(self) -> dict:
        """Get sync statistics."""
        return {
            **self._sync_stats,
            "data_dir": str(DATA_DIR),
        }


# Global instance
kline_sync = KlineSync()
