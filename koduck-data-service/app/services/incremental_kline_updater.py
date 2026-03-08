"""Incremental K-line data updater.

This module provides functionality for incrementally updating K-line data,
automatically detecting existing data ranges and fetching only missing data.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from app.db import Database
from app.services.akshare_client import akshare_client

logger = logging.getLogger(__name__)


@dataclass
class IncrementalUpdateResult:
    """Result of an incremental K-line data update operation."""

    symbol: str
    timeframe: str
    records_added: int
    records_updated: int
    date_range: dict
    data: list[dict]

    def to_dict(self) -> dict:
        """Convert result to dictionary."""
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "records_added": self.records_added,
            "records_updated": self.records_updated,
            "date_range": self.date_range,
            "data": self.data,
        }


class IncrementalKlineUpdater:
    """Handles incremental updates for K-line data.

    This class provides methods to:
    - Detect existing data ranges in the local database
    - Fetch missing data from AKShare
    - Merge new data with existing records
    - Support different deduplication strategies
    """

    def __init__(self):
        """Initialize the updater."""
        self.client = akshare_client

    async def get_local_data_range(
        self, symbol: str, timeframe: str, market: str = "AShare"
    ) -> tuple[Optional[datetime], Optional[datetime]]:
        """Get the existing data range for a symbol and timeframe.

        Args:
            symbol: Stock symbol (e.g., '000001')
            timeframe: Timeframe (e.g., '1D', '1W', '1M')
            market: Market identifier

        Returns:
            Tuple of (min_date, max_date) or (None, None) if no data exists
        """
        try:
            db_timeframe = self._map_timeframe_to_db(timeframe)

            query = """
                SELECT MIN(kline_time) as min_date, MAX(kline_time) as max_date
                FROM kline_data
                WHERE market = $1
                  AND symbol = $2
                  AND timeframe = $3
            """

            result = await Database.fetchrow(
                query, market, symbol, db_timeframe
            )

            if result and result["min_date"] and result["max_date"]:
                logger.info(
                    f"Local data range for {symbol} ({timeframe}): "
                    f"{result['min_date']} to {result['max_date']}"
                )
                return result["min_date"], result["max_date"]

            logger.info(f"No existing data found for {symbol} ({timeframe})")
            return None, None

        except Exception as e:
            logger.error(f"Failed to get local data range: {e}")
            return None, None

    async def incremental_update(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        timeframe: str = "1D",
        market: str = "AShare",
        limit: int = 300,
        dry_run: bool = False,
    ) -> IncrementalUpdateResult:
        """Incrementally update K-line data for a symbol.

        This method:
        1. Checks existing local data range
        2. Determines missing date ranges
        3. Fetches new data from AKShare
        4. Merges with existing data
        5. Returns update statistics

        Args:
            symbol: Stock symbol (e.g., '000001')
            start_date: Start date for update (YYYYMMDD). If None, uses local max date
            end_date: End date for update (YYYYMMDD). If None, uses today
            timeframe: Timeframe (1D, 1W, 1M)
            market: Market identifier
            limit: Maximum number of records to fetch
            dry_run: If True, only return what would be updated without persisting

        Returns:
            IncrementalUpdateResult with update statistics
        """
        logger.info(
            f"Starting incremental update for {symbol} ({timeframe}), "
            f"start={start_date}, end={end_date}, dry_run={dry_run}"
        )

        # Get local data range
        local_min, local_max = await self.get_local_data_range(symbol, timeframe, market)

        # Determine fetch range
        fetch_start = start_date
        fetch_end = end_date

        if local_max and not start_date:
            # Continue from local max date (add 1 day to avoid duplicates)
            next_day = local_max + timedelta(days=1)
            fetch_start = next_day.strftime("%Y%m%d")

        # Fetch data from AKShare
        period = self._map_timeframe_to_akshare(timeframe)

        try:
            klines = self.client.get_kline_data(
                symbol=symbol,
                period=period,
                start_date=fetch_start,
                end_date=fetch_end,
                limit=limit,
            )
        except Exception as e:
            logger.error(f"Failed to fetch data from AKShare: {e}")
            return IncrementalUpdateResult(
                symbol=symbol,
                timeframe=timeframe,
                records_added=0,
                records_updated=0,
                date_range={"start": None, "end": None},
                data=[],
            )

        if not klines:
            logger.info(f"No new data fetched for {symbol}")
            return IncrementalUpdateResult(
                symbol=symbol,
                timeframe=timeframe,
                records_added=0,
                records_updated=0,
                date_range={"start": None, "end": None},
                data=[],
            )

        # Process and merge data
        if not dry_run:
            records_added = await self._save_kline_data(klines, symbol, timeframe, market)
        else:
            records_added = len(klines)

        # Get date range of fetched data
        fetched_dates = [datetime.fromtimestamp(k["timestamp"]) for k in klines]
        fetched_min = min(fetched_dates) if fetched_dates else None
        fetched_max = max(fetched_dates) if fetched_dates else None

        result = IncrementalUpdateResult(
            symbol=symbol,
            timeframe=timeframe,
            records_added=records_added,
            records_updated=0,  # Currently only inserts, no updates
            date_range={
                "start": fetched_min.strftime("%Y-%m-%d") if fetched_min else None,
                "end": fetched_max.strftime("%Y-%m-%d") if fetched_max else None,
            },
            data=klines,
        )

        logger.info(
            f"Incremental update completed: {records_added} records added for {symbol}"
        )
        return result

    async def _save_kline_data(
        self,
        klines: list[dict],
        symbol: str,
        timeframe: str,
        market: str,
    ) -> int:
        """Save K-line data to database.

        Uses INSERT ... ON CONFLICT to handle duplicates.

        Args:
            klines: List of K-line data dictionaries
            symbol: Stock symbol
            timeframe: Timeframe
            market: Market identifier

        Returns:
            Number of records inserted
        """
        if not klines:
            return 0

        db_timeframe = self._map_timeframe_to_db(timeframe)
        records_inserted = 0

        try:
            for kline in klines:
                # Convert timestamp to datetime
                kline_time = datetime.fromtimestamp(kline["timestamp"])

                query = """
                    INSERT INTO kline_data (
                        market, symbol, timeframe, kline_time,
                        open_price, high_price, low_price, close_price,
                        volume, amount, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                    ON CONFLICT (market, symbol, timeframe, kline_time) DO NOTHING
                """

                result = await Database.execute(
                    query,
                    market,
                    symbol,
                    db_timeframe,
                    kline_time,
                    kline.get("open", 0),
                    kline.get("high", 0),
                    kline.get("low", 0),
                    kline.get("close", 0),
                    kline.get("volume", 0),
                    kline.get("amount", 0),
                )

                # Check if row was inserted
                # asyncpg returns the query result as string like "INSERT 0 1"
                if result and "INSERT" in result:
                    records_inserted += 1

            logger.info(f"Inserted {records_inserted} new records for {symbol}")

        except Exception as e:
            logger.error(f"Failed to save K-line data: {e}")
            raise

        return records_inserted

    def _map_timeframe_to_db(self, timeframe: str) -> str:
        """Map timeframe to database format."""
        mapping = {
            "1D": "1D",
            "1W": "1W",
            "1M": "1M",
            "daily": "1D",
            "weekly": "1W",
            "monthly": "1M",
        }
        return mapping.get(timeframe, timeframe)

    def _map_timeframe_to_akshare(self, timeframe: str) -> str:
        """Map timeframe to AKShare period format."""
        mapping = {
            "1D": "daily",
            "1W": "weekly",
            "1M": "monthly",
        }
        return mapping.get(timeframe, timeframe)


# Global updater instance
incremental_kline_updater = IncrementalKlineUpdater()
