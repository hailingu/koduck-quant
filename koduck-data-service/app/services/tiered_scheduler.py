"""Tiered update scheduler for layered watchlist architecture.

Manages scheduled updates for track and watch layers with different frequencies.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Set, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.models.tiered_watchlist import (
    Priority, UpdateTask, TrackStockData, WatchKlineData,
    TrackingLevel, DataFreshnessStatus
)
from app.services.tiered_queue import TieredPriorityQueue, TieredUpdateWorker
from app.services.tiered_redis import TieredRedisStore

logger = logging.getLogger(__name__)


@dataclass
class SchedulerConfig:
    """Configuration for tiered scheduler."""
    track_update_interval: int = 10          # Track layer update interval (seconds)
    watch_update_interval: int = 60          # Watch layer update interval (seconds)
    track_batch_size: int = 100              # Max stocks per track batch
    watch_batch_size: int = 100              # Max stocks per watch batch
    track_max_stocks: int = 100              # Max track layer stocks per user
    watch_max_stocks: int = 1500             # Max watch layer stocks per user
    freshness_threshold: int = 120           # Data freshness threshold (seconds)


class TieredUpdateScheduler:
    """Scheduler for tiered watchlist updates.
    
    Manages:
    - Track layer: Real-time updates every 10 seconds
    - Watch layer: Background async updates every 60 seconds
    """
    
    def __init__(
        self,
        redis_store: TieredRedisStore,
        eastmoney_client: Any,  # Type hint avoids circular import
        config: Optional[SchedulerConfig] = None
    ):
        self.redis = redis_store
        self.eastmoney = eastmoney_client
        self.config = config or SchedulerConfig()
        
        self.queue = TieredPriorityQueue()
        self.worker = TieredUpdateWorker(
            self.queue,
            max_concurrent=5,
            rate_limit_per_second=10
        )
        
        # Background tasks
        self._track_task: Optional[asyncio.Task] = None
        self._watch_task: Optional[asyncio.Task] = None
        self._running = False
        
        # Statistics
        self._stats = {
            "track_updates": 0,
            "watch_updates": 0,
            "track_stocks_updated": 0,
            "watch_stocks_updated": 0,
            "last_track_update": None,
            "last_watch_update": None,
        }
        
        # Register handlers
        self._register_handlers()
        
        logger.info("TieredUpdateScheduler initialized")
    
    def _register_handlers(self):
        """Register task handlers."""
        self.worker.register_handler("track_update", self._handle_track_update)
        self.worker.register_handler("watch_update", self._handle_watch_update)
        self.worker.register_handler("track_batch", self._handle_track_batch)
    
    async def start(self):
        """Start the scheduler."""
        if self._running:
            return
        
        self._running = True
        
        # Start worker
        await self.worker.start()
        
        # Start background update tasks
        self._track_task = asyncio.create_task(self._track_update_loop())
        self._watch_task = asyncio.create_task(self._watch_update_loop())
        
        logger.info("TieredUpdateScheduler started")
    
    async def stop(self):
        """Stop the scheduler."""
        self._running = False
        
        # Cancel background tasks
        if self._track_task:
            self._track_task.cancel()
            try:
                await self._track_task
            except asyncio.CancelledError:
                pass
        
        if self._watch_task:
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass
        
        # Stop worker
        await self.worker.stop()
        
        logger.info("TieredUpdateScheduler stopped")
    
    async def _track_update_loop(self):
        """Background loop for track layer updates."""
        while self._running:
            try:
                await self._schedule_track_update()
                await asyncio.sleep(self.config.track_update_interval)
            except Exception as e:
                logger.error(f"Track update loop error: {e}")
                await asyncio.sleep(5)
    
    async def _watch_update_loop(self):
        """Background loop for watch layer updates."""
        while self._running:
            try:
                await self._schedule_watch_update()
                await asyncio.sleep(self.config.watch_update_interval)
            except Exception as e:
                logger.error(f"Watch update loop error: {e}")
                await asyncio.sleep(5)
    
    async def _schedule_track_update(self):
        """Schedule track layer update for all unique track stocks."""
        try:
            # Get all unique track layer stocks
            track_stocks = await self.redis.get_all_track_stocks()
            
            if not track_stocks:
                return
            
            # Batch into groups
            for i in range(0, len(track_stocks), self.config.track_batch_size):
                batch = track_stocks[i:i + self.config.track_batch_size]
                
                task = UpdateTask(
                    priority=Priority.TRACK_BATCH,
                    symbols=batch,
                    task_type="track_batch"
                )
                await self.queue.enqueue(task)
            
            logger.debug(f"Scheduled track update for {len(track_stocks)} stocks")
            
        except Exception as e:
            logger.error(f"Failed to schedule track update: {e}")
    
    async def _schedule_watch_update(self):
        """Schedule watch layer update for all unique watch stocks."""
        try:
            # Get all unique watch layer stocks
            watch_stocks = await self.redis.get_all_watch_stocks()
            
            if not watch_stocks:
                return
            
            # Batch into groups with rate limiting
            for i in range(0, len(watch_stocks), self.config.watch_batch_size):
                batch = watch_stocks[i:i + self.config.watch_batch_size]
                
                task = UpdateTask(
                    priority=Priority.WATCH_KLINE_1M,
                    symbols=batch,
                    task_type="watch_update"
                )
                await self.queue.enqueue(task)
                
                # Rate limit between batches
                await asyncio.sleep(1)
            
            self._stats["last_watch_update"] = datetime.now().isoformat()
            logger.info(f"Scheduled watch update for {len(watch_stocks)} stocks")
            
        except Exception as e:
            logger.error(f"Failed to schedule watch update: {e}")
    
    async def _handle_track_update(self, symbols: List[str]):
        """Handle real-time track layer update.
        
        Args:
            symbols: List of stock symbols to update
        """
        try:
            # Fetch real-time data from EastMoney
            data = await self.eastmoney.fetch_batch_detailed(symbols)
            
            # Store in Redis
            for symbol, quote in data.items():
                track_data = TrackStockData(
                    symbol=symbol,
                    price=quote.get("price", 0),
                    change_percent=quote.get("change_percent", 0),
                    bid_price=quote.get("bid_price"),
                    ask_price=quote.get("ask_price"),
                    bid_volume=quote.get("bid_volume"),
                    ask_volume=quote.get("ask_volume"),
                    volume=quote.get("volume"),
                    amount=quote.get("amount"),
                    timestamp=int(datetime.now().timestamp())
                )
                await self.redis.set_track_data(symbol, track_data)
            
            self._stats["track_updates"] += 1
            self._stats["track_stocks_updated"] += len(symbols)
            self._stats["last_track_update"] = datetime.now().isoformat()
            
            logger.debug(f"Updated track layer for {len(symbols)} stocks")
            
        except Exception as e:
            logger.error(f"Track update failed: {e}")
    
    async def _handle_track_batch(self, symbols: List[str]):
        """Handle track batch update.
        
        Args:
            symbols: List of stock symbols to update
        """
        # Same as track update for now
        await self._handle_track_update(symbols)
    
    async def _handle_watch_update(self, symbols: List[str]):
        """Handle watch layer 1-minute kline update.
        
        Args:
            symbols: List of stock symbols to update
        """
        try:
            # Fetch 1-minute kline data
            klines = await self.eastmoney.fetch_minute_kline_batch(symbols)
            
            # Store in Redis
            for symbol, kline_data in klines.items():
                watch_data = WatchKlineData(
                    symbol=symbol,
                    timestamp=kline_data.get("timestamp", int(datetime.now().timestamp())),
                    open=kline_data.get("open", 0),
                    high=kline_data.get("high", 0),
                    low=kline_data.get("low", 0),
                    close=kline_data.get("close", 0),
                    volume=kline_data.get("volume", 0),
                    amount=kline_data.get("amount")
                )
                await self.redis.add_watch_kline(symbol, watch_data)
            
            self._stats["watch_updates"] += 1
            self._stats["watch_stocks_updated"] += len(symbols)
            
            logger.debug(f"Updated watch layer for {len(symbols)} stocks")
            
        except Exception as e:
            logger.error(f"Watch update failed: {e}")
    
    async def add_user_track_stock(self, user_id: int, symbol: str) -> bool:
        """Add stock to user's track layer.
        
        Args:
            user_id: User ID
            symbol: Stock symbol
            
        Returns:
            True if successful
        """
        try:
            # Check track layer limit
            current_count = await self.redis.get_user_track_count(user_id)
            if current_count >= self.config.track_max_stocks:
                logger.warning(f"User {user_id} track layer full: {current_count}/{self.config.track_max_stocks}")
                return False
            
            await self.redis.add_user_track_stock(user_id, symbol)
            
            # Trigger immediate update for this stock
            task = UpdateTask(
                priority=Priority.TRACK_REALTIME,
                symbols=[symbol],
                task_type="track_update"
            )
            await self.queue.enqueue(task)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add track stock: {e}")
            return False
    
    async def add_user_watch_stock(self, user_id: int, symbol: str) -> bool:
        """Add stock to user's watch layer.
        
        Args:
            user_id: User ID
            symbol: Stock symbol
            
        Returns:
            True if successful
        """
        try:
            # Check watch layer limit
            current_count = await self.redis.get_user_watch_count(user_id)
            if current_count >= self.config.watch_max_stocks:
                logger.warning(f"User {user_id} watch layer full: {current_count}/{self.config.watch_max_stocks}")
                return False
            
            await self.redis.add_user_watch_stock(user_id, symbol)
            return True
            
        except Exception as e:
            logger.error(f"Failed to add watch stock: {e}")
            return False
    
    async def get_user_tiered_data(self, user_id: int) -> Dict[str, Any]:
        """Get tiered watchlist data for user.
        
        Args:
            user_id: User ID
            
        Returns:
            Tiered data dictionary
        """
        try:
            # Get user's track and watch stocks
            track_symbols = await self.redis.get_user_track_stocks(user_id)
            watch_symbols = await self.redis.get_user_watch_stocks(user_id)
            
            # Get track layer data (real-time)
            track_data = []
            for symbol in track_symbols:
                data = await self.redis.get_track_data(symbol)
                if data:
                    track_data.append(data)
            
            # Get watch layer data (1-min kline)
            watch_data = []
            for symbol in watch_symbols:
                data = await self.redis.get_watch_latest(symbol)
                if data:
                    watch_data.append(data)
            
            # Calculate freshness status
            now = int(datetime.now().timestamp())
            fresh_count = 0
            stale_count = 0
            
            for item in watch_data:
                age = now - item.timestamp
                if age < self.config.freshness_threshold:
                    fresh_count += 1
                else:
                    stale_count += 1
            
            return {
                "track_layer": track_data,
                "watch_layer": watch_data,
                "track_count": len(track_data),
                "watch_count": len(watch_data),
                "watch_update_status": {
                    "total": len(watch_data),
                    "fresh": fresh_count,
                    "stale": stale_count
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get user tiered data: {e}")
            return {
                "track_layer": [],
                "watch_layer": [],
                "track_count": 0,
                "watch_count": 0,
                "watch_update_status": {"total": 0, "fresh": 0, "stale": 0}
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get scheduler statistics.
        
        Returns:
            Statistics dictionary
        """
        return {
            **self._stats,
            "running": self._running,
            "config": {
                "track_update_interval": self.config.track_update_interval,
                "watch_update_interval": self.config.watch_update_interval,
                "track_max_stocks": self.config.track_max_stocks,
                "watch_max_stocks": self.config.watch_max_stocks,
            },
            "queue_stats": self.queue.get_queue_stats() if hasattr(self.queue, 'get_queue_stats') else {},
            "worker_stats": self.worker.get_stats(),
        }
