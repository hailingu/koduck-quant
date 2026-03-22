"""Redis cache for tick data.

Provides caching for:
- Hot/latest tick data
- Batch data export for Java backend
- Rate limiting and deduplication
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict

import aioredis
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CachedTick:
    """Tick data structure for caching."""
    symbol: str
    price: float
    change: float
    change_percent: float
    volume: int
    timestamp: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    prev_close: Optional[float] = None
    bid_price: Optional[float] = None
    ask_price: Optional[float] = None


class TickRedisCache:
    """Redis cache manager for tick data.
    
    Provides:
    - Latest tick caching for fast retrieval
    - Batch data export for Java backend
    - Symbol watchlist caching
    """
    
    # Cache key patterns
    KEY_LATEST_TICK = "tick:latest:{symbol}"
    KEY_SYMBOL_LIST = "tick:symbols"
    KEY_BATCH_DATA = "tick:batch:{batch_id}"
    KEY_EXPORT_QUEUE = "tick:export:queue"
    KEY_METRICS = "tick:metrics"
    
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        
        # Cache TTL settings (in seconds)
        self.ttl_latest_tick = getattr(settings, 'TICK_CACHE_TTL_LATEST', 300)  # 5 minutes
        self.ttl_batch_data = getattr(settings, 'TICK_CACHE_TTL_BATCH', 3600)  # 1 hour
        self.ttl_metrics = getattr(settings, 'TICK_CACHE_TTL_METRICS', 60)  # 1 minute
    
    async def connect(self):
        """Connect to Redis."""
        if self._connected:
            return
        
        try:
            self._redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding='utf-8',
                decode_responses=True
            )
            # Test connection
            await self._redis.ping()
            self._connected = True
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._connected = False
            raise
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self._redis:
            await self._redis.close()
            self._connected = False
            logger.info("Disconnected from Redis")
    
    async def cache_latest_tick(self, symbol: str, tick_data: Dict[str, Any]) -> bool:
        """Cache the latest tick for a symbol.
        
        Args:
            symbol: Stock symbol
            tick_data: Tick data dictionary
            
        Returns:
            True if cached successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            key = self.KEY_LATEST_TICK.format(symbol=symbol)
            
            # Add timestamp if not present
            if 'timestamp' not in tick_data:
                tick_data['timestamp'] = datetime.now().isoformat()
            
            # Store as hash
            await self._redis.hset(key, mapping={
                k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                for k, v in tick_data.items()
            })
            
            # Set expiration
            await self._redis.expire(key, self.ttl_latest_tick)
            
            # Add to symbol list
            await self._redis.sadd(self.KEY_SYMBOL_LIST, symbol)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache tick for {symbol}: {e}")
            return False
    
    async def get_latest_tick(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get cached latest tick for a symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Tick data or None if not found
        """
        if not self._connected or not self._redis:
            return None
        
        try:
            key = self.KEY_LATEST_TICK.format(symbol=symbol)
            data = await self._redis.hgetall(key)
            
            if not data:
                return None
            
            # Parse values
            result = {}
            for k, v in data.items():
                try:
                    result[k] = json.loads(v)
                except json.JSONDecodeError:
                    # Try to convert to number
                    try:
                        if '.' in v:
                            result[k] = float(v)
                        else:
                            result[k] = int(v)
                    except ValueError:
                        result[k] = v
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get cached tick for {symbol}: {e}")
            return None
    
    async def get_latest_ticks_batch(self, symbols: List[str]) -> Dict[str, Optional[Dict[str, Any]]]:
        """Get cached latest ticks for multiple symbols.
        
        Args:
            symbols: List of stock symbols
            
        Returns:
            Dictionary of symbol -> tick data (or None)
        """
        if not self._connected or not self._redis:
            return {s: None for s in symbols}
        
        results = {}
        
        # Use pipeline for efficiency
        pipe = self._redis.pipeline()
        
        for symbol in symbols:
            key = self.KEY_LATEST_TICK.format(symbol=symbol)
            pipe.hgetall(key)
        
        try:
            responses = await pipe.execute()
            
            for symbol, data in zip(symbols, responses):
                if data:
                    # Parse values
                    result = {}
                    for k, v in data.items():
                        try:
                            result[k] = json.loads(v)
                        except json.JSONDecodeError:
                            try:
                                if '.' in v:
                                    result[k] = float(v)
                                else:
                                    result[k] = int(v)
                            except ValueError:
                                result[k] = v
                    results[symbol] = result
                else:
                    results[symbol] = None
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get batch ticks: {e}")
            return {s: None for s in symbols}
    
    async def cache_batch_for_export(
        self, 
        batch_id: str, 
        data: List[Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache a batch of data for export to Java backend.
        
        Args:
            batch_id: Unique batch identifier
            data: List of tick data dictionaries
            ttl: Custom TTL (uses default if None)
            
        Returns:
            True if cached successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            key = self.KEY_BATCH_DATA.format(batch_id=batch_id)
            
            # Store as JSON list
            await self._redis.set(
                key, 
                json.dumps(data),
                ex=ttl or self.ttl_batch_data
            )
            
            logger.info(f"Cached batch {batch_id} with {len(data)} records")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache batch {batch_id}: {e}")
            return False
    
    async def get_batch_for_export(self, batch_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached batch data for export.
        
        Args:
            batch_id: Batch identifier
            
        Returns:
            List of tick data or None if not found/expired
        """
        if not self._connected or not self._redis:
            return None
        
        try:
            key = self.KEY_BATCH_DATA.format(batch_id=batch_id)
            data = await self._redis.get(key)
            
            if data:
                return json.loads(data)
            return None
            
        except Exception as e:
            logger.error(f"Failed to get batch {batch_id}: {e}")
            return None
    
    async def delete_batch(self, batch_id: str) -> bool:
        """Delete a cached batch.
        
        Args:
            batch_id: Batch identifier
            
        Returns:
            True if deleted successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            key = self.KEY_BATCH_DATA.format(batch_id=batch_id)
            await self._redis.delete(key)
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete batch {batch_id}: {e}")
            return False
    
    async def queue_for_export(self, symbol: str, priority: int = 5) -> bool:
        """Queue a symbol for batch export.
        
        Args:
            symbol: Stock symbol
            priority: Priority (1-10, lower is higher priority)
            
        Returns:
            True if queued successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            # Use sorted set with priority as score
            await self._redis.zadd(
                self.KEY_EXPORT_QUEUE,
                {symbol: priority}
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to queue {symbol} for export: {e}")
            return False
    
    async def get_export_queue(self, limit: int = 100) -> List[tuple]:
        """Get symbols in the export queue.
        
        Args:
            limit: Maximum number of symbols to return
            
        Returns:
            List of (symbol, priority) tuples
        """
        if not self._connected or not self._redis:
            return []
        
        try:
            # Get by score (lowest first)
            results = await self._redis.zrange(
                self.KEY_EXPORT_QUEUE,
                0,
                limit - 1,
                withscores=True
            )
            return [(item[0], int(item[1])) for item in results]
            
        except Exception as e:
            logger.error(f"Failed to get export queue: {e}")
            return []
    
    async def remove_from_export_queue(self, symbol: str) -> bool:
        """Remove a symbol from the export queue.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            True if removed successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            await self._redis.zrem(self.KEY_EXPORT_QUEUE, symbol)
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove {symbol} from queue: {e}")
            return False
    
    async def cache_metrics(self, metrics: Dict[str, Any]) -> bool:
        """Cache system metrics.
        
        Args:
            metrics: Metrics dictionary
            
        Returns:
            True if cached successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            await self._redis.setex(
                self.KEY_METRICS,
                self.ttl_metrics,
                json.dumps(metrics)
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache metrics: {e}")
            return False
    
    async def get_cached_metrics(self) -> Optional[Dict[str, Any]]:
        """Get cached system metrics.
        
        Returns:
            Metrics dictionary or None
        """
        if not self._connected or not self._redis:
            return None
        
        try:
            data = await self._redis.get(self.KEY_METRICS)
            if data:
                return json.loads(data)
            return None
            
        except Exception as e:
            logger.error(f"Failed to get cached metrics: {e}")
            return None
    
    async def get_cached_symbols(self) -> List[str]:
        """Get list of symbols with cached data.
        
        Returns:
            List of symbols
        """
        if not self._connected or not self._redis:
            return []
        
        try:
            symbols = await self._redis.smembers(self.KEY_SYMBOL_LIST)
            return list(symbols)
            
        except Exception as e:
            logger.error(f"Failed to get cached symbols: {e}")
            return []
    
    async def invalidate_symbol(self, symbol: str) -> bool:
        """Invalidate cached data for a symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            True if invalidated successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            key = self.KEY_LATEST_TICK.format(symbol=symbol)
            await self._redis.delete(key)
            await self._redis.srem(self.KEY_SYMBOL_LIST, symbol)
            return True
            
        except Exception as e:
            logger.error(f"Failed to invalidate {symbol}: {e}")
            return False
    
    async def invalidate_all(self) -> bool:
        """Invalidate all cached tick data.
        
        Returns:
            True if invalidated successfully
        """
        if not self._connected or not self._redis:
            return False
        
        try:
            # Find and delete all tick keys
            pattern = self.KEY_LATEST_TICK.format(symbol="*")
            cursor = 0
            
            while True:
                cursor, keys = await self._redis.scan(cursor, match=pattern, count=100)
                if keys:
                    await self._redis.delete(*keys)
                if cursor == 0:
                    break
            
            # Clear symbol list
            await self._redis.delete(self.KEY_SYMBOL_LIST)
            
            logger.info("Invalidated all cached tick data")
            return True
            
        except Exception as e:
            logger.error(f"Failed to invalidate all cache: {e}")
            return False
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics.
        
        Returns:
            Cache statistics dictionary
        """
        if not self._connected or not self._redis:
            return {'connected': False}
        
        try:
            info = await self._redis.info('memory')
            symbol_count = await self._redis.scard(self.KEY_SYMBOL_LIST)
            queue_size = await self._redis.zcard(self.KEY_EXPORT_QUEUE)
            
            return {
                'connected': True,
                'cached_symbols': symbol_count,
                'export_queue_size': queue_size,
                'memory_used': info.get('used_memory_human', 'unknown'),
                'memory_peak': info.get('used_memory_peak_human', 'unknown'),
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {'connected': True, 'error': str(e)}


# Global cache instance
tick_redis_cache = TickRedisCache()


async def init_cache():
    """Initialize the global cache connection."""
    await tick_redis_cache.connect()


async def close_cache():
    """Close the global cache connection."""
    await tick_redis_cache.disconnect()


# Convenience functions
async def cache_tick(symbol: str, data: Dict[str, Any]) -> bool:
    """Cache a tick (convenience function)."""
    return await tick_redis_cache.cache_latest_tick(symbol, data)


async def get_cached_tick(symbol: str) -> Optional[Dict[str, Any]]:
    """Get cached tick (convenience function)."""
    return await tick_redis_cache.get_latest_tick(symbol)
