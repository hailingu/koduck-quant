"""Incremental K-line data updater.

This module provides functionality for incrementally updating K-line data,
automatically detecting existing data ranges and fetching only missing data.

Data flow:
1. Fetch new data from AKShare
2. Append to CSV file (cache)
3. Import to PostgreSQL database
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

from app.db import Database
from app.services.akshare_client import akshare_client

logger = logging.getLogger(__name__)

# CSV data directory
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"


@dataclass
class IncrementalUpdateResult:
    """Result of an incremental K-line data update operation."""

    symbol: str
    timeframe: str
    records_added: int
    records_updated: int
    csv_records_added: int
    date_range: dict
    data: list[dict]

    def to_dict(self) -> dict:
        """Convert result to dictionary."""
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "records_added": self.records_added,
            "records_updated": self.records_updated,
            "csv_records_added": self.csv_records_added,
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
                csv_records_added=0,
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
                csv_records_added=0,
                date_range={"start": None, "end": None},
                data=[],
            )

        # Process and merge data
        csv_records_added = 0
        if not dry_run:
            # Step 1: Save to CSV (cache)
            csv_records_added = self._save_to_csv(klines, symbol, timeframe)
            
            # Step 2: Save to database
            db_records_added = await self._save_kline_data(klines, symbol, timeframe, market)
            
            records_added = db_records_added
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
            csv_records_added=csv_records_added,
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

    def _get_csv_path(self, symbol: str, timeframe: str) -> Path:
        """Get the CSV file path for a symbol and timeframe.
        
        Args:
            symbol: Stock symbol
            timeframe: Timeframe (e.g., '1D')
            
        Returns:
            Path to the CSV file
        """
        return DATA_DIR / timeframe / f"{symbol}.csv"
    
    def _load_csv_data(self, csv_path: Path) -> pd.DataFrame:
        """Load CSV data into DataFrame.
        
        Args:
            csv_path: Path to CSV file
            
        Returns:
            DataFrame with CSV data, empty if file doesn't exist
        """
        if not csv_path.exists():
            return pd.DataFrame()
        
        try:
            df = pd.read_csv(csv_path, encoding='utf-8-sig')
            return df
        except Exception as e:
            logger.error(f"Failed to load CSV {csv_path}: {e}")
            return pd.DataFrame()
    
    def _save_to_csv(
        self,
        klines: list[dict],
        symbol: str,
        timeframe: str,
    ) -> int:
        """Append K-line data to CSV file.
        
        This method:
        1. Loads existing CSV data
        2. Merges new data (deduplication by timestamp)
        3. Sorts by timestamp
        4. Saves back to CSV
        
        Args:
            klines: List of K-line data dictionaries
            symbol: Stock symbol
            timeframe: Timeframe
            
        Returns:
            Number of records added to CSV
        """
        if not klines:
            return 0
        
        csv_path = self._get_csv_path(symbol, timeframe)
        
        # Ensure directory exists
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing data
        existing_df = self._load_csv_data(csv_path)
        
        # Convert new data to DataFrame
        new_data = []
        for kline in klines:
            new_data.append({
                "symbol": symbol,
                "name": kline.get("name", ""),
                "datetime": datetime.fromtimestamp(kline["timestamp"]).strftime("%Y-%m-%d"),
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
            # Combine existing and new data
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            # Deduplicate by timestamp, keep last (newest)
            merged_df = combined_df.drop_duplicates(subset=["timestamp"], keep="last")
        
        # Sort by timestamp
        merged_df = merged_df.sort_values(by="timestamp", ascending=True)
        
        # Save to CSV
        try:
            merged_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            records_added = len(merged_df) - len(existing_df)
            logger.info(f"Saved {records_added} new records to CSV for {symbol}")
            return max(0, records_added)
        except Exception as e:
            logger.error(f"Failed to save CSV {csv_path}: {e}")
            raise
    
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
