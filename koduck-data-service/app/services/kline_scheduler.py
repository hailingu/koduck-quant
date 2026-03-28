"""K-line scheduled update service.

This module provides automatic scheduled updates for K-line data,
ensuring CSV files and database are kept up-to-date without
conflicting with initialization or manual updates.
"""

import asyncio
from datetime import datetime, time
from enum import Enum
from pathlib import Path
from typing import Optional

import structlog

from app.db import Database
from app.services.eastmoney_client import eastmoney_client
from app.services.kline_file_lock import csv_lock
from app.services.kline_storage import KlineStorage
from app.services.kline_sync import kline_sync
from app.utils.trading_hours import is_a_share_trading_time

logger = structlog.get_logger(__name__)
SCHEDULED_PERIOD_MAP = {"1D": "101", "1W": "102", "1M": "103"}


class SchedulerState(Enum):
    """Scheduler operation states."""
    
    IDLE = "idle"               # Waiting for next update
    INITIALIZING = "initializing"  # Startup initialization in progress
    UPDATING = "updating"       # Runtime update in progress
    ERROR = "error"             # Error occurred, will retry


class KlineScheduler:
    """Scheduled K-line data updater.
    
    This service runs in the background and periodically updates
    K-line data from external sources. It coordinates with:
    - KlineInitializer: Waits for startup import to complete
    - File locks: Prevents concurrent CSV writes
    - Database sync: Updates PostgreSQL after CSV update
    """
    
    def __init__(
        self,
        check_interval: int = 3600,  # Check every hour
        update_time: str = "15:35",   # Update at market close + 5min
        timezone: str = "Asia/Shanghai",
    ):
        """Initialize scheduler.
        
        Args:
            check_interval: Seconds between checks
            update_time: Time to run daily update (HH:MM format)
            timezone: Timezone for scheduling
        """
        self._check_interval = check_interval
        self._update_time = self._parse_time(update_time)
        self._timezone = timezone
        
        self._state = SchedulerState.IDLE
        self._state_lock = asyncio.Lock()
        self._init_completed = False
        self._task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        
        # Statistics
        self._stats = {
            "last_check": None,
            "last_update": None,
            "updates_count": 0,
            "errors_count": 0,
        }
        self._storage = KlineStorage()
    
    @staticmethod
    def _parse_time(time_str: str) -> time:
        """Parse time string to time object."""
        hour, minute = map(int, time_str.split(":"))
        return time(hour, minute)
    
    async def mark_initialization_complete(self) -> None:
        """Mark that KlineInitializer has completed.
        
        This should be called by KlineInitializer after startup import.
        """
        async with self._state_lock:
            if self._state == SchedulerState.INITIALIZING:
                self._state = SchedulerState.IDLE
            self._init_completed = True
            logger.info("Initialization marked as complete, scheduler can now run updates")
    
    async def start(self) -> None:
        """Start the scheduler."""
        async with self._state_lock:
            if self._state == SchedulerState.IDLE and not self._init_completed:
                # Wait for initialization
                self._state = SchedulerState.INITIALIZING
                logger.info("Scheduler waiting for initialization to complete")
        
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "K-line scheduler started",
            check_interval=self._check_interval,
            update_time=self._update_time.isoformat(),
        )
    
    async def stop(self) -> None:
        """Stop the scheduler gracefully."""
        logger.info("Stopping K-line scheduler...")
        self._shutdown_event.set()
        
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("K-line scheduler stopped")
    
    async def _run_loop(self) -> None:
        """Main scheduler loop."""
        while not self._shutdown_event.is_set():
            try:
                # Check if it's time to update
                if await self._should_update():
                    await self._do_update()
                
                # Wait for next check interval or shutdown
                try:
                    await asyncio.wait_for(
                        self._shutdown_event.wait(),
                        timeout=self._check_interval,
                    )
                except asyncio.TimeoutError:
                    pass  # Normal timeout, continue loop
                    
            except Exception as e:
                logger.error("Error in scheduler loop", exc_info=True)
                async with self._state_lock:
                    self._state = SchedulerState.ERROR
                    self._stats["errors_count"] += 1
                
                # Wait before retry
                await asyncio.sleep(60)
    
    async def _should_update(self) -> bool:
        """Check if conditions are met for update.
        
        Returns True if:
        - Initialization is complete
        - Current time is past update_time
        - Not already updating
        - It's a trading day (weekday)
        - Not within trading hours (only update outside trading hours)
        """
        async with self._state_lock:
            if not self._init_completed:
                logger.debug("Initialization not complete, skipping update")
                return False
            
            if self._state != SchedulerState.IDLE:
                logger.debug(f"Scheduler state is {self._state.value}, skipping update")
                return False
        
        # Check if it's time to update (after market close)
        now = datetime.now()
        
        # Only update on weekdays
        if now.weekday() >= 5:  # Saturday=5, Sunday=6
            logger.debug("Weekend, skipping update")
            return False
        
        # Check if within trading hours - only update outside trading hours
        if is_a_share_trading_time(now):
            logger.debug("Within trading hours, skipping update")
            return False
        
        # Check if past update time
        current_time = now.time()
        if current_time < self._update_time:
            logger.debug("Before update time, skipping")
            return False
        
        # Check if already updated today
        last_update = self._stats["last_update"]
        if last_update and last_update.date() == now.date():
            logger.debug("Already updated today, skipping")
            return False
        
        return True
    
    async def _do_update(self) -> None:
        """Execute the update."""
        async with self._state_lock:
            self._state = SchedulerState.UPDATING
        
        try:
            logger.info("Starting scheduled K-line update")
            
            # Find all local kline files to update
            DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"
            
            updated_symbols = []
            
            for tf_dir in DATA_DIR.iterdir():
                if not tf_dir.is_dir():
                    continue
                
                timeframe = tf_dir.name
                if timeframe not in SCHEDULED_PERIOD_MAP:
                    logger.debug(
                        "Skipping unsupported timeframe directory in scheduled update",
                        timeframe=timeframe,
                    )
                    continue
                
                for data_file in self._storage.list_kline_files(DATA_DIR, [timeframe]):
                    symbol = data_file.stem
                    
                    # Try to acquire lock
                    with csv_lock(symbol, timeframe, blocking=False) as acquired:
                        if not acquired:
                            logger.warning(
                                f"{symbol} kline file is locked, skipping scheduled update"
                            )
                            continue
                        
                        # Update this symbol
                        success = await self._update_symbol(symbol, timeframe)
                        if success:
                            updated_symbols.append((symbol, timeframe))
            
            # Sync to database
            if updated_symbols:
                await self._sync_to_database(updated_symbols)
            
            # Update stats
            self._stats["last_update"] = datetime.now()
            self._stats["updates_count"] += 1
            
            logger.info(
                "Scheduled K-line update completed",
                symbols_updated=len(updated_symbols),
            )
            
        except Exception as e:
            logger.error("Scheduled update failed", exc_info=True)
            self._stats["errors_count"] += 1
            raise
        finally:
            async with self._state_lock:
                self._state = SchedulerState.IDLE
    
    async def _update_symbol(self, symbol: str, timeframe: str) -> bool:
        """Update a single symbol from Eastmoney API.
        
        Args:
            symbol: Stock symbol
            timeframe: Timeframe (1D, 5m, etc.)
            
        Returns:
            True if successful
        """
        import pandas as pd
        
        try:
            if timeframe not in SCHEDULED_PERIOD_MAP:
                logger.debug(
                    "Skipping unsupported timeframe in scheduled update",
                    symbol=symbol,
                    timeframe=timeframe,
                )
                return True

            if symbol.isdigit():
                symbol = symbol.zfill(6)

            DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"
            tf_dir = DATA_DIR / timeframe
            file_path = self._storage.discover_symbol_path(tf_dir, symbol)
            
            # Get last date from local kline file
            if file_path.exists():
                df = self._storage.read_dataframe(file_path)
                if not df.empty:
                    last_timestamp = df['timestamp'].max()
                    last_date = datetime.fromtimestamp(last_timestamp)
                    start_date = (last_date + pd.Timedelta(days=1)).strftime("%Y%m%d")
                else:
                    start_date = (datetime.now() - pd.Timedelta(days=30)).strftime("%Y%m%d")
            else:
                start_date = (datetime.now() - pd.Timedelta(days=30)).strftime("%Y%m%d")
            
            end_date = datetime.now().strftime("%Y%m%d")
            
            if start_date > end_date:
                logger.debug(f"{symbol}: Already up to date")
                return True
            
            # Fetch from Eastmoney
            period = SCHEDULED_PERIOD_MAP[timeframe]
            secid_prefix = "1" if symbol.startswith("6") else "0"
            
            logger.debug(f"{symbol}: Fetching {start_date} to {end_date}")
            
            data = eastmoney_client.fetch_kline_data(
                symbol=symbol,
                secid_prefix=secid_prefix,
                period=period,
                start_date=start_date,
                end_date=end_date,
            )
            
            if not data:
                logger.warning(f"{symbol}: No data returned")
                return False
            
            # Append to CSV
            new_records = []
            for record in data:
                new_records.append({
                    'timestamp': record['timestamp'],
                    'open': record['open'],
                    'high': record['high'],
                    'low': record['low'],
                    'close': record['close'],
                    'volume': record['volume'],
                    'amount': record.get('amount'),
                })
            
            # Merge with existing
            if file_path.exists():
                df = self._storage.read_dataframe(file_path)
                existing = df.to_dict('records')
            else:
                existing = []
            
            all_data = existing + new_records
            
            # Deduplicate
            seen = set()
            unique = []
            for r in sorted(all_data, key=lambda x: x['timestamp']):
                if r['timestamp'] not in seen:
                    seen.add(r['timestamp'])
                    unique.append(r)
            
            # Save
            df = pd.DataFrame(unique)
            df['symbol'] = symbol
            df['name'] = ""
            # Keep date in Asia/Shanghai to match A-share trading calendar.
            bj = pd.to_datetime(df['timestamp'], unit='s', utc=True).dt.tz_convert('Asia/Shanghai')
            df['datetime'] = bj.dt.normalize().dt.tz_localize(None)
            
            df = df[['symbol', 'name', 'datetime', 'timestamp', 'open', 'high', 'low', 'close', 'volume', 'amount']]
            self._storage.write_dataframe(df, file_path)
            
            logger.info(f"{symbol}: Updated with {len(new_records)} new records")
            return True
            
        except Exception as e:
            logger.error(f"{symbol}: Update failed - {e}")
            return False
    
    async def _sync_to_database(self, symbols: list[tuple[str, str]]) -> None:
        """Sync updated CSV files to database.
        
        Args:
            symbols: List of (symbol, timeframe) tuples
        """
        try:
            unique_timeframes = list(set(tf for _, tf in symbols))
            unique_symbols = list(set(s for s, _ in symbols))
            
            results = await kline_sync.sync_all(
                timeframes=unique_timeframes,
                symbols=unique_symbols,
            )
            
            logger.info(
                "Database sync completed",
                imported=results['imported'],
                skipped=results['skipped'],
            )
        except Exception as e:
            logger.error("Database sync failed", exc_info=True)
    
    def get_status(self) -> dict:
        """Get scheduler status and statistics."""
        return {
            "state": self._state.value,
            "init_completed": self._init_completed,
            "stats": self._stats,
            "config": {
                "check_interval": self._check_interval,
                "update_time": self._update_time.isoformat(),
                "timezone": self._timezone,
            },
        }


# Global instance
kline_scheduler = KlineScheduler()
