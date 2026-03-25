"""1-minute K-line data tool for fetching and incremental updates.

This module provides functionality for fetching historical 1-minute K-line data
and performing incremental updates, supporting high-frequency trading strategies
and intraday analysis.

Features:
- Historical 1-minute K-line data fetching
- Incremental update mechanism
- Automatic trading time filtering
- CSV cache and database persistence
- Progress callback support
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

from app.db import Database
from app.services.akshare_client import akshare_client

logger = logging.getLogger(__name__)

# CSV data directory for 1-minute K-line
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline" / "1m"

# A-share trading time constants (minutes per session)
MORNING_MINUTES = 120  # 09:30 - 11:30
AFTERNOON_MINUTES = 120  # 13:00 - 15:00
DAILY_TRADING_MINUTES = MORNING_MINUTES + AFTERNOON_MINUTES  # 240
ASIA_SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


@dataclass
class Minute1KlineResult:
    """Result of a 1-minute K-line data operation."""

    symbol: str
    records_added: int
    records_updated: int
    csv_records_added: int
    date_range: dict[str, str | None]
    trading_days: int
    data: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert result to dictionary."""
        return {
            "symbol": self.symbol,
            "records_added": self.records_added,
            "records_updated": self.records_updated,
            "csv_records_added": self.csv_records_added,
            "date_range": self.date_range,
            "trading_days": self.trading_days,
            "data": self.data,
        }


@dataclass
class DataGap:
    """Represents a gap in the data."""

    start: datetime
    end: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
        }


class Minute1KlineTool:
    """Tool for fetching and managing 1-minute K-line data.

    This class provides methods to:
    - Fetch historical 1-minute K-line data
    - Incrementally update data (detect gaps and fetch missing data)
    - Validate data continuity
    - Store data in CSV cache and database

    Example:
        ```python
        tool = Minute1KlineTool()

        # Get historical data
        result = tool.get_history(
            symbol="000001",
            start_date="2024-12-01",
            end_date="2024-12-10",
        )

        # Incremental update
        result = tool.incremental_update(
            symbol="000001",
            days_back=7,
        )
        ```
    """

    def __init__(
        self,
        cache_dir: Path | None = None,
        progress_callback: Callable[[int, int, str], None] | None = None,
    ):
        """Initialize the 1-minute K-line tool.

        Args:
            cache_dir: Directory for CSV cache files. Default: data/kline/1m/
            progress_callback: Optional callback for progress updates.
                Called with (current, total, message).
        """
        self._cache_dir = cache_dir or DATA_DIR
        self._progress_callback = progress_callback
        self._client = akshare_client

    def _report_progress(self, current: int, total: int, message: str) -> None:
        """Report progress to callback if available."""
        if self._progress_callback:
            self._progress_callback(current, total, message)

    def _get_csv_path(self, symbol: str) -> Path:
        """Get CSV file path for a symbol.

        Args:
            symbol: Stock symbol (e.g., '000001')

        Returns:
            Path to the CSV file
        """
        return self._cache_dir / f"{symbol}.csv"

    def _ensure_cache_dir(self) -> None:
        """Ensure cache directory exists."""
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def get_history(
        self,
        symbol: str,
        start_date: str,
        end_date: str | None = None,
        market: str = "CN",
        save_to_cache: bool = True,
    ) -> Minute1KlineResult:
        """Fetch historical 1-minute K-line data for a symbol.

        Args:
            symbol: Stock symbol (e.g., '000001', '002326')
            start_date: Start date (YYYY-MM-DD format)
            end_date: End date (YYYY-MM-DD format). Default: today
            market: Market identifier ('CN' for A-share)
            save_to_cache: Whether to save data to CSV cache

        Returns:
            Minute1KlineResult with fetched data and statistics
        """
        logger.info(
            f"Fetching 1-minute K-line history for {symbol}, "
            f"start={start_date}, end={end_date}"
        )

        # Parse dates
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        else:
            end_dt = datetime.now()

        # Fetch data from AKShare
        self._report_progress(0, 100, f"Fetching data for {symbol}...")

        try:
            # AKShare returns recent minute data only
            # For historical data, we need to use a different approach
            klines = self._fetch_minute_data(symbol, start_dt, end_dt)

            if not klines:
                logger.warning(f"No data fetched for {symbol}")
                return Minute1KlineResult(
                    symbol=symbol,
                    records_added=0,
                    records_updated=0,
                    csv_records_added=0,
                    date_range={"start": None, "end": None},
                    trading_days=0,
                    data=[],
                )

            self._report_progress(50, 100, f"Fetched {len(klines)} records")

            # Save to cache if requested
            csv_records_added = 0
            if save_to_cache:
                csv_records_added = self._save_to_cache(symbol, klines)
                self._report_progress(
                    80, 100, f"Saved {csv_records_added} records to cache"
                )

            # Calculate statistics
            fetched_dates = [
                datetime.fromtimestamp(k["timestamp"], tz=ASIA_SHANGHAI_TZ).replace(
                    tzinfo=None
                )
                for k in klines
            ]
            fetched_min = min(fetched_dates) if fetched_dates else None
            fetched_max = max(fetched_dates) if fetched_dates else None

            # Count trading days
            trading_days = self._count_trading_days(fetched_min, fetched_max)

            result = Minute1KlineResult(
                symbol=symbol,
                records_added=len(klines),
                records_updated=0,
                csv_records_added=csv_records_added,
                date_range={
                    "start": (
                        fetched_min.strftime("%Y-%m-%d %H:%M:%S")
                        if fetched_min
                        else None
                    ),
                    "end": (
                        fetched_max.strftime("%Y-%m-%d %H:%M:%S")
                        if fetched_max
                        else None
                    ),
                },
                trading_days=trading_days,
                data=klines,
            )

            self._report_progress(100, 100, "Complete")
            logger.info(
                f"History fetch completed: {result.records_added} records for {symbol}"
            )

            return result

        except Exception as e:
            logger.error(f"Failed to fetch history for {symbol}: {e}")
            raise

    def _fetch_minute_data(
        self,
        symbol: str,
        start_dt: datetime,
        end_dt: datetime,
    ) -> list[dict]:
        """Fetch minute-level data from AKShare.

        Note: AKShare's stock_zh_a_hist_min_em only returns recent data.
        For historical data spanning multiple days, we need to fetch
        and filter the data.

        Args:
            symbol: Stock symbol
            start_dt: Start datetime
            end_dt: End datetime

        Returns:
            List of K-line data dictionaries
        """
        try:
            # Fetch 1-minute data from AKShare
            # Note: This API returns recent data (typically last few days)
            klines = self._client.get_kline_minutes(
                symbol=symbol, period="1", limit=5000
            )

            if not klines:
                return []

            # Filter by date range
            start_ts = int(start_dt.timestamp())
            end_ts = int(end_dt.replace(
                hour=23, minute=59, second=59
            ).timestamp())

            filtered = [
                k for k in klines
                if start_ts <= k["timestamp"] <= end_ts
            ]

            logger.info(
                f"Fetched {len(klines)} records, filtered to {len(filtered)} "
                f"for {symbol} ({start_dt.date()} to {end_dt.date()})"
            )

            return filtered

        except Exception as e:
            logger.error(f"Failed to fetch minute data for {symbol}: {e}")
            return []

    async def incremental_update(
        self,
        symbol: str,
        days_back: int = 7,
        market: str = "CN",
        dry_run: bool = False,
    ) -> Minute1KlineResult:
        """Incrementally update 1-minute K-line data.

        This method:
        1. Checks existing local data range
        2. Determines missing data gaps
        3. Fetches new data from AKShare
        4. Merges with existing data
        5. Returns update statistics

        Args:
            symbol: Stock symbol (e.g., '000001')
            days_back: Number of days to look back for updates
            market: Market identifier
            dry_run: If True, only return what would be updated

        Returns:
            Minute1KlineResult with update statistics
        """
        logger.info(
            f"Starting incremental update for {symbol}, days_back={days_back}"
        )

        # Get local data range
        local_min, local_max = self._get_local_data_range(symbol)

        # Determine fetch range
        end_dt = datetime.now()
        if local_max:
            # Continue from local max + 1 minute
            start_dt = local_max + timedelta(minutes=1)
        else:
            # No local data, fetch from days_back
            start_dt = end_dt - timedelta(days=days_back)

        # Skip if start is in the future
        if start_dt >= end_dt:
            logger.info(f"{symbol} data is up to date")
            return Minute1KlineResult(
                symbol=symbol,
                records_added=0,
                records_updated=0,
                csv_records_added=0,
                date_range={"start": None, "end": None},
                trading_days=0,
                data=[],
            )

        self._report_progress(0, 100, f"Fetching new data for {symbol}...")

        # Fetch new data
        try:
            klines = self._fetch_minute_data(symbol, start_dt, end_dt)

            if not klines:
                logger.info(f"No new data for {symbol}")
                return Minute1KlineResult(
                    symbol=symbol,
                    records_added=0,
                    records_updated=0,
                    csv_records_added=0,
                    date_range={"start": None, "end": None},
                    trading_days=0,
                    data=[],
                )

            self._report_progress(50, 100, f"Fetched {len(klines)} new records")

            # Save to cache and database
            csv_records_added = 0
            records_added = 0

            if not dry_run:
                csv_records_added = self._save_to_cache(symbol, klines)
                self._report_progress(75, 100, f"Saved {csv_records_added} to cache")

                # Save to database
                records_added = await self._save_to_database(symbol, klines, market)
                self._report_progress(90, 100, f"Saved {records_added} to database")
            else:
                records_added = len(klines)

            # Calculate statistics
            fetched_dates = [
                datetime.fromtimestamp(k["timestamp"], tz=ASIA_SHANGHAI_TZ).replace(
                    tzinfo=None
                )
                for k in klines
            ]
            fetched_min = min(fetched_dates) if fetched_dates else None
            fetched_max = max(fetched_dates) if fetched_dates else None
            trading_days = self._count_trading_days(fetched_min, fetched_max)

            result = Minute1KlineResult(
                symbol=symbol,
                records_added=records_added,
                records_updated=0,
                csv_records_added=csv_records_added,
                date_range={
                    "start": (
                        fetched_min.strftime("%Y-%m-%d %H:%M:%S")
                        if fetched_min
                        else None
                    ),
                    "end": (
                        fetched_max.strftime("%Y-%m-%d %H:%M:%S")
                        if fetched_max
                        else None
                    ),
                },
                trading_days=trading_days,
                data=klines,
            )

            self._report_progress(100, 100, "Complete")
            logger.info(
                f"Incremental update completed: {records_added} records for {symbol}"
            )

            return result

        except Exception as e:
            logger.error(f"Incremental update failed for {symbol}: {e}")
            raise

    def _get_local_data_range(
        self, symbol: str
    ) -> tuple[datetime | None, datetime | None]:
        """Get the existing data range from local cache.

        Args:
            symbol: Stock symbol

        Returns:
            Tuple of (min_datetime, max_datetime) or (None, None) if no data
        """
        csv_path = self._get_csv_path(symbol)

        if not csv_path.exists():
            return None, None

        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")

            if df.empty or "timestamp" not in df.columns:
                return None, None

            min_ts = df["timestamp"].min()
            max_ts = df["timestamp"].max()

            min_dt = datetime.fromtimestamp(min_ts, tz=ASIA_SHANGHAI_TZ).replace(
                tzinfo=None
            )
            max_dt = datetime.fromtimestamp(max_ts, tz=ASIA_SHANGHAI_TZ).replace(
                tzinfo=None
            )

            logger.info(f"Local data range for {symbol}: {min_dt} to {max_dt}")
            return min_dt, max_dt

        except Exception as e:
            logger.error(f"Failed to read local data for {symbol}: {e}")
            return None, None

    def _save_to_cache(self, symbol: str, klines: list[dict]) -> int:
        """Save K-line data to CSV cache.

        This method:
        1. Loads existing CSV data
        2. Merges new data (deduplication by timestamp)
        3. Sorts by timestamp
        4. Saves back to CSV

        Args:
            symbol: Stock symbol
            klines: List of K-line data dictionaries

        Returns:
            Number of new records added
        """
        if not klines:
            return 0

        self._ensure_cache_dir()
        csv_path = self._get_csv_path(symbol)

        # Load existing data
        existing_df = pd.DataFrame()
        if csv_path.exists():
            try:
                existing_df = pd.read_csv(csv_path, encoding="utf-8-sig")
            except Exception as e:
                logger.warning(f"Failed to load existing cache: {e}")

        # Convert new data to DataFrame
        new_data = []
        for kline in klines:
            dt = datetime.fromtimestamp(
                kline["timestamp"], tz=ASIA_SHANGHAI_TZ
            ).replace(tzinfo=None)
            new_data.append({
                "symbol": symbol,
                "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
                "timestamp": kline["timestamp"],
                "open": kline.get("open", 0),
                "high": kline.get("high", 0),
                "low": kline.get("low", 0),
                "close": kline.get("close", 0),
                "volume": kline.get("volume", 0),
                "amount": kline.get("amount", 0),
            })

        new_df = pd.DataFrame(new_data)

        # Merge and deduplicate
        if existing_df.empty:
            merged_df = new_df
        else:
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            merged_df = combined_df.drop_duplicates(
                subset=["timestamp"], keep="last"
            )

        # Sort by timestamp
        merged_df = merged_df.sort_values(by="timestamp", ascending=True)

        # Save to CSV
        try:
            merged_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
            records_added = len(merged_df) - len(existing_df)
            logger.info(f"Saved {records_added} new records to cache for {symbol}")
            return max(0, records_added)
        except Exception as e:
            logger.error(f"Failed to save cache for {symbol}: {e}")
            raise

    async def _save_to_database(
        self,
        symbol: str,
        klines: list[dict],
        market: str,
    ) -> int:
        """Save K-line data to database.

        Uses batch insert for better performance. Handles conflicts by
        skipping duplicate records.

        Args:
            symbol: Stock symbol
            klines: List of K-line data dictionaries
            market: Market identifier

        Returns:
            Number of records inserted
        """
        if not klines:
            return 0

        records_inserted = 0

        try:
            # Use executemany for batch insert
            records = []
            for kline in klines:
                kline_time = datetime.fromtimestamp(
                    kline["timestamp"], tz=ASIA_SHANGHAI_TZ
                ).replace(tzinfo=None)
                records.append((
                    market,
                    symbol,
                    "1m",  # 1-minute timeframe
                    kline_time,
                    kline.get("open", 0),
                    kline.get("high", 0),
                    kline.get("low", 0),
                    kline.get("close", 0),
                    kline.get("volume", 0),
                    kline.get("amount", 0),
                ))

            query = """
                INSERT INTO kline_data (
                    market, symbol, timeframe, kline_time,
                    open_price, high_price, low_price, close_price,
                    volume, amount, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                ON CONFLICT (market, symbol, timeframe, kline_time) DO NOTHING
            """

            # Get pool and execute batch insert
            pool = await Database.get_pool()
            async with pool.acquire() as conn:
                # Use executemany for batch insert
                results = await conn.executemany(query, records)

            # Count successful inserts
            # Results is a list of command status strings like "INSERT 0 1"
            for result in results:
                if result and "INSERT" in str(result):
                    # Parse the count from "INSERT oid count"
                    parts = str(result).split()
                    if len(parts) >= 3:
                        try:
                            count = int(parts[2])
                            records_inserted += count
                        except ValueError:
                            pass

            logger.info(f"Inserted {records_inserted}/{len(klines)} records to database for {symbol}")

        except Exception as e:
            logger.error(f"Failed to save to database for {symbol}: {e}")
            raise

        return records_inserted

    def _count_trading_days(
        self,
        start_dt: datetime | None,
        end_dt: datetime | None,
    ) -> int:
        """Count approximate trading days between two datetimes.

        This is a simple weekday count. For accurate trading day count,
        use a trading calendar.

        Args:
            start_dt: Start datetime
            end_dt: End datetime

        Returns:
            Approximate number of trading days
        """
        if not start_dt or not end_dt:
            return 0

        # Simple weekday count (excludes weekends)
        current = start_dt.date()
        end = end_dt.date()
        trading_days = 0

        while current <= end:
            if current.weekday() < 5:  # Monday to Friday
                trading_days += 1
            current += timedelta(days=1)

        return trading_days

    def detect_gaps(
        self,
        symbol: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[DataGap]:
        """Detect gaps in the 1-minute K-line data.

        This method identifies missing time periods within trading hours
        that should have data but don't.

        Args:
            symbol: Stock symbol
            start_date: Start date for gap detection (YYYY-MM-DD)
            end_date: End date for gap detection (YYYY-MM-DD)

        Returns:
            List of DataGap objects representing missing periods
        """
        csv_path = self._get_csv_path(symbol)

        if not csv_path.exists():
            return []

        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")

            if df.empty or "timestamp" not in df.columns:
                return []

            # Get existing timestamps
            existing_ts = set(df["timestamp"].tolist())

            # Parse date range
            if start_date:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            else:
                start_dt = datetime.fromtimestamp(
                    df["timestamp"].min(), tz=ASIA_SHANGHAI_TZ
                ).replace(tzinfo=None)

            if end_date:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                end_dt = end_dt.replace(hour=15, minute=0)
            else:
                end_dt = datetime.fromtimestamp(
                    df["timestamp"].max(), tz=ASIA_SHANGHAI_TZ
                ).replace(tzinfo=None)

            # Generate expected timestamps for trading hours
            gaps = []
            current_dt = start_dt.replace(hour=9, minute=30, second=0)
            gap_start = None

            while current_dt <= end_dt:
                # Skip weekends
                if current_dt.weekday() >= 5:
                    current_dt += timedelta(days=1)
                    continue

                # Only check trading hours
                time_of_day = current_dt.time()

                # Morning session: 09:30 - 11:30
                # Afternoon session: 13:00 - 15:00
                is_trading_time = (
                    (time_of_day >= datetime.strptime("09:30", "%H:%M").time() and
                     time_of_day <= datetime.strptime("11:30", "%H:%M").time()) or
                    (time_of_day >= datetime.strptime("13:00", "%H:%M").time() and
                     time_of_day <= datetime.strptime("15:00", "%H:%M").time())
                )

                if is_trading_time:
                    ts = int(current_dt.timestamp())

                    if ts not in existing_ts:
                        if gap_start is None:
                            gap_start = current_dt
                    else:
                        if gap_start is not None:
                            gaps.append(
                                DataGap(
                                    start=gap_start,
                                    end=current_dt - timedelta(minutes=1),
                                )
                            )
                            gap_start = None

                # Move to next minute
                current_dt += timedelta(minutes=1)

                # Handle lunch break
                if time_of_day == datetime.strptime("11:30", "%H:%M").time():
                    current_dt = current_dt.replace(hour=13, minute=0)

                # Handle end of day
                if time_of_day == datetime.strptime("15:00", "%H:%M").time():
                    current_dt = (current_dt + timedelta(days=1)).replace(
                        hour=9, minute=30
                    )

            # Handle gap at the end
            if gap_start is not None:
                gaps.append(
                    DataGap(
                        start=gap_start,
                        end=current_dt - timedelta(minutes=1),
                    )
                )

            logger.info(f"Detected {len(gaps)} gaps in data for {symbol}")
            return gaps

        except Exception as e:
            logger.error(f"Failed to detect gaps for {symbol}: {e}")
            return []

    def validate_data_continuity(
        self,
        symbol: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        """Validate data continuity and quality.

        Args:
            symbol: Stock symbol
            start_date: Start date for validation (YYYY-MM-DD)
            end_date: End date for validation (YYYY-MM-DD)

        Returns:
            Dictionary with validation results
        """
        gaps = self.detect_gaps(symbol, start_date, end_date)

        csv_path = self._get_csv_path(symbol)
        total_records = 0

        if csv_path.exists():
            try:
                df = pd.read_csv(csv_path, encoding="utf-8-sig")
                total_records = len(df)
            except Exception as e:
                logger.warning(f"Failed to read CSV for validation: {e}")

        return {
            "symbol": symbol,
            "is_continuous": len(gaps) == 0,
            "gap_count": len(gaps),
            "gaps": [g.to_dict() for g in gaps],
            "total_records": total_records,
            "validation_time": datetime.now().isoformat(),
        }

    def get_cached_data(
        self,
        symbol: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict]:
        """Get cached 1-minute K-line data from CSV.

        Args:
            symbol: Stock symbol
            start_date: Start date filter (YYYY-MM-DD)
            end_date: End date filter (YYYY-MM-DD)

        Returns:
            List of K-line data dictionaries
        """
        csv_path = self._get_csv_path(symbol)

        if not csv_path.exists():
            return []

        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")

            if df.empty:
                return []

            # Apply date filters
            if start_date:
                start_ts = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp())
                df = df[df["timestamp"] >= start_ts]

            if end_date:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                end_ts = int(end_dt.replace(hour=23, minute=59, second=59).timestamp())
                df = df[df["timestamp"] <= end_ts]

            # Convert to list of dicts
            return df.to_dict("records")

        except Exception as e:
            logger.error(f"Failed to get cached data for {symbol}: {e}")
            return []


# Global instance
minute1_kline_tool = Minute1KlineTool()
