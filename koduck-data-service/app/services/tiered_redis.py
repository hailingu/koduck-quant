"""Redis storage for tiered watchlist data.

Provides storage for:
- Track layer: Hash with 30s TTL
- Watch layer: Sorted Set with 1h TTL
"""

import json
import logging
from typing import Dict, List, Optional, Set, Any
from datetime import datetime

import redis.asyncio as redis

from app.models.tiered_watchlist import TrackStockData, WatchKlineData

logger = logging.getLogger(__name__)


# Redis key patterns
REDIS_KEY_TRACK_DATA = "stock:track:{symbol}"  # Hash: real-time data
REDIS_KEY_WATCH_KLINE = "stock:watch:1m:{symbol}"  # Sorted Set: 1-min klines
REDIS_KEY_USER_TRACK = "user:{user_id}:track"  # Set: user's track stocks
REDIS_KEY_USER_WATCH = "user:{user_id}:watch"  # Set: user's watch stocks
REDIS_KEY_ALL_TRACK = "global:track:symbols"  # Set: all unique track symbols
REDIS_KEY_ALL_WATCH = "global:watch:symbols"  # Set: all unique watch symbols

# TTL settings
TTL_TRACK_DATA = 30  # 30 seconds
TTL_WATCH_KLINE = 3600  # 1 hour


class TieredRedisStore:
    """Redis storage for tiered watchlist data.
    
    Storage strategies:
    - Track layer: Redis Hash with short TTL (30s)
    - Watch layer: Redis Sorted Set by timestamp (1h TTL)
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self._redis = redis_client
        self._initialized = False
    
    async def initialize(self, host: str = "localhost", port: int = 6379, db: int = 0):
        """Initialize Redis connection.
        
        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
        """
        if self._redis is None:
            self._redis = redis.Redis(
                host=host,
                port=port,
                db=db,
                decode_responses=True
            )
        self._initialized = True
        logger.info("TieredRedisStore initialized")
    
    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._initialized = False
            logger.info("TieredRedisStore closed")
    
    # Track Layer Operations
    
    async def set_track_data(self, symbol: str, data: TrackStockData) -> bool:
        """Store track layer real-time data.
        
        Args:
            symbol: Stock symbol
            data: Track stock data
            
        Returns:
            True if successful
        """
        try:
            key = REDIS_KEY_TRACK_DATA.format(symbol=symbol)
            
            # Store as hash
            await self._redis.hset(key, mapping={
                "price": str(data.price),
                "change_percent": str(data.change_percent),
                "bid_price": str(data.bid_price) if data.bid_price else "",
                "ask_price": str(data.ask_price) if data.ask_price else "",
                "bid_volume": str(data.bid_volume) if data.bid_volume else "",
                "ask_volume": str(data.ask_volume) if data.ask_volume else "",
                "volume": str(data.volume) if data.volume else "",
                "amount": str(data.amount) if data.amount else "",
                "timestamp": str(data.timestamp)
            })
            
            # Set TTL
            await self._redis.expire(key, TTL_TRACK_DATA)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to set track data for {symbol}: {e}")
            return False
    
    async def get_track_data(self, symbol: str) -> Optional[TrackStockData]:
        """Get track layer real-time data.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Track stock data or None
        """
        try:
            key = REDIS_KEY_TRACK_DATA.format(symbol=symbol)
            data = await self._redis.hgetall(key)
            
            if not data:
                return None
            
            def parse_float(value: str) -> Optional[float]:
                return float(value) if value else None
            
            def parse_int(value: str) -> Optional[int]:
                return int(value) if value else None
            
            return TrackStockData(
                symbol=symbol,
                price=float(data.get("price", 0)),
                change_percent=float(data.get("change_percent", 0)),
                bid_price=parse_float(data.get("bid_price")),
                ask_price=parse_float(data.get("ask_price")),
                bid_volume=parse_int(data.get("bid_volume")),
                ask_volume=parse_int(data.get("ask_volume")),
                volume=parse_int(data.get("volume")),
                amount=parse_float(data.get("amount")),
                timestamp=int(data.get("timestamp", 0))
            )
            
        except Exception as e:
            logger.error(f"Failed to get track data for {symbol}: {e}")
            return None
    
    async def get_track_data_batch(self, symbols: List[str]) -> Dict[str, TrackStockData]:
        """Get track data for multiple symbols.
        
        Args:
            symbols: List of stock symbols
            
        Returns:
            Dictionary of symbol to track data
        """
        result = {}
        for symbol in symbols:
            data = await self.get_track_data(symbol)
            if data:
                result[symbol] = data
        return result
    
    # Watch Layer Operations
    
    async def add_watch_kline(self, symbol: str, data: WatchKlineData) -> bool:
        """Add 1-minute kline to watch layer.
        
        Args:
            symbol: Stock symbol
            data: Watch kline data
            
        Returns:
            True if successful
        """
        try:
            key = REDIS_KEY_WATCH_KLINE.format(symbol=symbol)
            
            # Store as JSON in sorted set by timestamp
            kline_json = json.dumps({
                "open": data.open,
                "high": data.high,
                "low": data.low,
                "close": data.close,
                "volume": data.volume,
                "amount": data.amount
            })
            
            await self._redis.zadd(key, {kline_json: data.timestamp})
            
            # Set TTL and trim old data
            await self._redis.expire(key, TTL_WATCH_KLINE)
            
            # Keep only last 60 data points (1 hour)
            await self._redis.zremrangebyrank(key, 0, -61)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add watch kline for {symbol}: {e}")
            return False
    
    async def get_watch_klines(self, symbol: str, count: int = 60) -> List[WatchKlineData]:
        """Get recent 1-minute klines for symbol.
        
        Args:
            symbol: Stock symbol
            count: Number of klines to return
            
        Returns:
            List of watch kline data
        """
        try:
            key = REDIS_KEY_WATCH_KLINE.format(symbol=symbol)
            
            # Get latest klines
            results = await self._redis.zrevrange(key, 0, count - 1, withscores=True)
            
            klines = []
            for kline_json, timestamp in results:
                data = json.loads(kline_json)
                klines.append(WatchKlineData(
                    symbol=symbol,
                    timestamp=int(timestamp),
                    open=data["open"],
                    high=data["high"],
                    low=data["low"],
                    close=data["close"],
                    volume=data["volume"],
                    amount=data.get("amount")
                ))
            
            return list(reversed(klines))
            
        except Exception as e:
            logger.error(f"Failed to get watch klines for {symbol}: {e}")
            return []
    
    async def get_watch_latest(self, symbol: str) -> Optional[WatchKlineData]:
        """Get latest 1-minute kline for symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Latest watch kline data or None
        """
        klines = await self.get_watch_klines(symbol, count=1)
        return klines[0] if klines else None
    
    # User Stock Set Operations
    
    async def add_user_track_stock(self, user_id: int, symbol: str) -> bool:
        """Add stock to user's track layer.
        
        Args:
            user_id: User ID
            symbol: Stock symbol
            
        Returns:
            True if successful
        """
        try:
            # Add to user set
            user_key = REDIS_KEY_USER_TRACK.format(user_id=user_id)
            await self._redis.sadd(user_key, symbol)
            
            # Add to global set
            await self._redis.sadd(REDIS_KEY_ALL_TRACK, symbol)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add track stock {symbol} for user {user_id}: {e}")
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
            # Add to user set
            user_key = REDIS_KEY_USER_WATCH.format(user_id=user_id)
            await self._redis.sadd(user_key, symbol)
            
            # Add to global set
            await self._redis.sadd(REDIS_KEY_ALL_WATCH, symbol)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add watch stock {symbol} for user {user_id}: {e}")
            return False
    
    async def remove_user_track_stock(self, user_id: int, symbol: str) -> bool:
        """Remove stock from user's track layer.
        
        Args:
            user_id: User ID
            symbol: Stock symbol
            
        Returns:
            True if successful
        """
        try:
            user_key = REDIS_KEY_USER_TRACK.format(user_id=user_id)
            await self._redis.srem(user_key, symbol)
            return True
        except Exception as e:
            logger.error(f"Failed to remove track stock {symbol} for user {user_id}: {e}")
            return False
    
    async def remove_user_watch_stock(self, user_id: int, symbol: str) -> bool:
        """Remove stock from user's watch layer.
        
        Args:
            user_id: User ID
            symbol: Stock symbol
            
        Returns:
            True if successful
        """
        try:
            user_key = REDIS_KEY_USER_WATCH.format(user_id=user_id)
            await self._redis.srem(user_key, symbol)
            return True
        except Exception as e:
            logger.error(f"Failed to remove watch stock {symbol} for user {user_id}: {e}")
            return False
    
    async def get_user_track_stocks(self, user_id: int) -> List[str]:
        """Get user's track layer stocks.
        
        Args:
            user_id: User ID
            
        Returns:
            List of stock symbols
        """
        try:
            user_key = REDIS_KEY_USER_TRACK.format(user_id=user_id)
            symbols = await self._redis.smembers(user_key)
            return list(symbols)
        except Exception as e:
            logger.error(f"Failed to get track stocks for user {user_id}: {e}")
            return []
    
    async def get_user_watch_stocks(self, user_id: int) -> List[str]:
        """Get user's watch layer stocks.
        
        Args:
            user_id: User ID
            
        Returns:
            List of stock symbols
        """
        try:
            user_key = REDIS_KEY_USER_WATCH.format(user_id=user_id)
            symbols = await self._redis.smembers(user_key)
            return list(symbols)
        except Exception as e:
            logger.error(f"Failed to get watch stocks for user {user_id}: {e}")
            return []
    
    async def get_user_track_count(self, user_id: int) -> int:
        """Get count of user's track layer stocks.
        
        Args:
            user_id: User ID
            
        Returns:
            Count of track stocks
        """
        try:
            user_key = REDIS_KEY_USER_TRACK.format(user_id=user_id)
            return await self._redis.scard(user_key)
        except Exception as e:
            logger.error(f"Failed to get track count for user {user_id}: {e}")
            return 0
    
    async def get_user_watch_count(self, user_id: int) -> int:
        """Get count of user's watch layer stocks.
        
        Args:
            user_id: User ID
            
        Returns:
            Count of watch stocks
        """
        try:
            user_key = REDIS_KEY_USER_WATCH.format(user_id=user_id)
            return await self._redis.scard(user_key)
        except Exception as e:
            logger.error(f"Failed to get watch count for user {user_id}: {e}")
            return 0
    
    # Global Stock Set Operations
    
    async def get_all_track_stocks(self) -> List[str]:
        """Get all unique track layer stocks across all users.
        
        Returns:
            List of stock symbols
        """
        try:
            symbols = await self._redis.smembers(REDIS_KEY_ALL_TRACK)
            return list(symbols)
        except Exception as e:
            logger.error(f"Failed to get all track stocks: {e}")
            return []
    
    async def get_all_watch_stocks(self) -> List[str]:
        """Get all unique watch layer stocks across all users.
        
        Returns:
            List of stock symbols
        """
        try:
            symbols = await self._redis.smembers(REDIS_KEY_ALL_WATCH)
            return list(symbols)
        except Exception as e:
            logger.error(f"Failed to get all watch stocks: {e}")
            return []
    
    # Statistics
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get Redis storage statistics.
        
        Returns:
            Statistics dictionary
        """
        try:
            track_count = await self._redis.scard(REDIS_KEY_ALL_TRACK)
            watch_count = await self._redis.scard(REDIS_KEY_ALL_WATCH)
            
            return {
                "total_track_stocks": track_count,
                "total_watch_stocks": watch_count,
                "track_data_ttl": TTL_TRACK_DATA,
                "watch_data_ttl": TTL_WATCH_KLINE,
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}
    
    async def clear_all(self):
        """Clear all tiered data (use with caution)."""
        try:
            # Get all keys with our patterns
            track_keys = await self._redis.keys("stock:track:*")
            watch_keys = await self._redis.keys("stock:watch:*")
            user_keys = await self._redis.keys("user:*:track") + await self._redis.keys("user:*:watch")
            global_keys = [REDIS_KEY_ALL_TRACK, REDIS_KEY_ALL_WATCH]
            
            all_keys = track_keys + watch_keys + user_keys + global_keys
            
            if all_keys:
                await self._redis.delete(*all_keys)
            
            logger.warning("All tiered data cleared")
            
        except Exception as e:
            logger.error(f"Failed to clear all data: {e}")


# Global instance
tiered_redis = TieredRedisStore()
