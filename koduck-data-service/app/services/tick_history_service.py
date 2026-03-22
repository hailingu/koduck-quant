"""Tick history service for querying and managing historical tick data.

This module provides high-level operations for tick history data,
including queries, analytics, and maintenance operations.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

from app.db import tick_history_db, Database
from app.config import settings
from app.services.tick_redis_cache import tick_redis_cache, cache_tick

logger = logging.getLogger(__name__)


@dataclass
class TickQueryResult:
    """Result container for tick history queries."""
    data: List[Dict]
    total: int
    page: int
    page_size: int
    has_more: bool


@dataclass
class TickStatistics:
    """Statistics for tick data in a time range."""
    symbol: str
    start_time: datetime
    end_time: datetime
    count: int
    avg_price: Optional[float]
    max_price: Optional[float]
    min_price: Optional[float]
    total_volume: Optional[int]
    total_amount: Optional[float]
    price_change: Optional[float]
    price_change_percent: Optional[float]


class TickHistoryService:
    """Service for tick history data operations."""
    
    DEFAULT_PAGE_SIZE = 1000
    MAX_PAGE_SIZE = 10000
    
    @staticmethod
    async def get_ticks(
        symbol: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = DEFAULT_PAGE_SIZE,
        offset: int = 0,
    ) -> TickQueryResult:
        """Get tick history for a symbol with pagination.
        
        Args:
            symbol: Stock symbol
            start_time: Start of time range (defaults to 1 day ago)
            end_time: End of time range (defaults to now)
            limit: Maximum number of records per page
            offset: Offset for pagination
            
        Returns:
            TickQueryResult containing data and pagination info
        """
        # Set default time range
        if end_time is None:
            end_time = datetime.now()
        if start_time is None:
            start_time = end_time - timedelta(days=1)
        
        # Validate and clamp limit
        limit = min(max(limit, 1), TickHistoryService.MAX_PAGE_SIZE)
        
        try:
            # Get total count
            total = await tick_history_db.get_ticks_count(symbol, start_time, end_time)
            
            # Get data
            data = await tick_history_db.get_ticks_by_time_range(
                symbol, start_time, end_time, limit, offset
            )
            
            has_more = (offset + len(data)) < total
            
            return TickQueryResult(
                data=data,
                total=total,
                page=offset // limit + 1,
                page_size=limit,
                has_more=has_more,
            )
        except Exception as e:
            logger.error(f"Error getting tick history for {symbol}: {e}")
            return TickQueryResult(
                data=[],
                total=0,
                page=1,
                page_size=limit,
                has_more=False,
            )
    
    @staticmethod
    async def get_latest_ticks(
        symbol: str,
        limit: int = 100,
    ) -> List[Dict]:
        """Get the most recent tick history records for a symbol.
        
        Args:
            symbol: Stock symbol
            limit: Maximum number of records to return
            
        Returns:
            List of tick history records
        """
        limit = min(max(limit, 1), TickHistoryService.MAX_PAGE_SIZE)
        return await tick_history_db.get_latest_ticks(symbol, limit)
    
    @staticmethod
    async def get_statistics(
        symbol: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> TickStatistics:
        """Get statistics for tick data in a time range.
        
        Args:
            symbol: Stock symbol
            start_time: Start of time range (defaults to 1 day ago)
            end_time: End of time range (defaults to now)
            
        Returns:
            TickStatistics object
        """
        if end_time is None:
            end_time = datetime.now()
        if start_time is None:
            start_time = end_time - timedelta(days=1)
        
        try:
            # Get all ticks in range (limited for performance)
            ticks = await tick_history_db.get_ticks_by_time_range(
                symbol, start_time, end_time, 
                limit=TickHistoryService.MAX_PAGE_SIZE, 
                offset=0
            )
            
            count = len(ticks)
            
            if count == 0:
                return TickStatistics(
                    symbol=symbol,
                    start_time=start_time,
                    end_time=end_time,
                    count=0,
                    avg_price=None,
                    max_price=None,
                    min_price=None,
                    total_volume=None,
                    total_amount=None,
                    price_change=None,
                    price_change_percent=None,
                )
            
            # Calculate statistics
            prices = [t['price'] for t in ticks if t.get('price') is not None]
            volumes = [t['volume'] for t in ticks if t.get('volume') is not None]
            amounts = [t['amount'] for t in ticks if t.get('amount') is not None]
            
            avg_price = sum(prices) / len(prices) if prices else None
            max_price = max(prices) if prices else None
            min_price = min(prices) if prices else None
            total_volume = sum(volumes) if volumes else None
            total_amount = sum(amounts) if amounts else None
            
            # Calculate price change
            first_price = ticks[0].get('price')
            last_price = ticks[-1].get('price')
            price_change = None
            price_change_percent = None
            
            if first_price is not None and last_price is not None and first_price != 0:
                price_change = last_price - first_price
                price_change_percent = (price_change / first_price) * 100
            
            return TickStatistics(
                symbol=symbol,
                start_time=start_time,
                end_time=end_time,
                count=count,
                avg_price=avg_price,
                max_price=max_price,
                min_price=min_price,
                total_volume=total_volume,
                total_amount=total_amount,
                price_change=price_change,
                price_change_percent=price_change_percent,
            )
        except Exception as e:
            logger.error(f"Error getting statistics for {symbol}: {e}")
            return TickStatistics(
                symbol=symbol,
                start_time=start_time,
                end_time=end_time,
                count=0,
                avg_price=None,
                max_price=None,
                min_price=None,
                total_volume=None,
                total_amount=None,
                price_change=None,
                price_change_percent=None,
            )
    
    @staticmethod
    async def cleanup_old_data(
        retention_days: Optional[int] = None,
    ) -> int:
        """Clean up old tick history data.
        
        Args:
            retention_days: Number of days to retain (defaults to settings)
            
        Returns:
            Number of records deleted
        """
        if retention_days is None:
            retention_days = settings.TICK_RETENTION_DAYS
        
        cutoff_time = datetime.now() - timedelta(days=retention_days)
        
        try:
            deleted = await tick_history_db.delete_old_ticks(cutoff_time)
            logger.info(f"Cleaned up {deleted} old tick records (retention: {retention_days} days)")
            return deleted
        except Exception as e:
            logger.error(f"Error cleaning up old tick data: {e}")
            return 0
    
    @staticmethod
    async def resample_ticks(
        ticks: List[Dict],
        interval_seconds: int = 60,
    ) -> List[Dict]:
        """Resample tick data to a lower frequency.
        
        Args:
            ticks: List of tick records
            interval_seconds: Target interval in seconds
            
        Returns:
            Resampled tick data
        """
        if not ticks or interval_seconds <= 0:
            return ticks
        
        from collections import defaultdict
        
        # Group ticks by interval
        buckets = defaultdict(list)
        
        for tick in ticks:
            tick_time = tick.get('tick_time')
            if tick_time:
                if isinstance(tick_time, str):
                    tick_time = datetime.fromisoformat(tick_time.replace('Z', '+00:00'))
                # Round to interval
                bucket_key = tick_time.replace(
                    second=(tick_time.second // interval_seconds) * interval_seconds,
                    microsecond=0
                )
                buckets[bucket_key].append(tick)
        
        # Aggregate each bucket
        resampled = []
        for bucket_time in sorted(buckets.keys()):
            bucket_ticks = buckets[bucket_time]
            if not bucket_ticks:
                continue
            
            prices = [t['price'] for t in bucket_ticks if t.get('price') is not None]
            volumes = [t['volume'] for t in bucket_ticks if t.get('volume') is not None]
            
            if not prices:
                continue
            
            resampled.append({
                'tick_time': bucket_time.isoformat(),
                'symbol': bucket_ticks[0].get('symbol'),
                'open': prices[0],
                'high': max(prices),
                'low': min(prices),
                'close': prices[-1],
                'avg': sum(prices) / len(prices),
                'volume': sum(volumes) if volumes else None,
                'count': len(bucket_ticks),
            })
        
        return resampled
    
    @staticmethod
    async def export_ticks_for_java_backend(
        symbols: List[str],
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        format: str = "json"
    ) -> Dict[str, Any]:
        """Export tick data for Java backend consumption.
        
        Args:
            symbols: List of stock symbols to export
            start_time: Start of time range (defaults to 1 hour ago)
            end_time: End of time range (defaults to now)
            format: Export format (json, csv)
            
        Returns:
            Export result with data and metadata
        """
        if end_time is None:
            end_time = datetime.now()
        if start_time is None:
            start_time = end_time - timedelta(hours=1)
        
        export_data = []
        failed_symbols = []
        
        for symbol in symbols:
            try:
                # Try to get from cache first
                cached = await tick_redis_cache.get_latest_ticks_batch([symbol])
                if cached.get(symbol):
                    export_data.append(cached[symbol])
                    continue
                
                # Get from database
                ticks = await tick_history_db.get_ticks_by_time_range(
                    symbol, start_time, end_time, limit=1000, offset=0
                )
                
                if ticks:
                    # Cache latest tick
                    await cache_tick(symbol, ticks[-1])
                    
                    export_data.append({
                        'symbol': symbol,
                        'ticks': ticks,
                        'count': len(ticks)
                    })
                else:
                    failed_symbols.append(symbol)
                    
            except Exception as e:
                logger.error(f"Failed to export ticks for {symbol}: {e}")
                failed_symbols.append(symbol)
        
        return {
            'data': export_data,
            'metadata': {
                'exported_at': datetime.now().isoformat(),
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'total_symbols': len(symbols),
                'successful': len(export_data),
                'failed': len(failed_symbols),
                'failed_symbols': failed_symbols,
                'format': format
            }
        }
    
    @staticmethod
    async def get_multi_symbol_ticks(
        symbols: List[str],
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit_per_symbol: int = 100
    ) -> Dict[str, List[Dict]]:
        """Get tick data for multiple symbols.
        
        Args:
            symbols: List of stock symbols
            start_time: Start of time range
            end_time: End of time range
            limit_per_symbol: Maximum ticks per symbol
            
        Returns:
            Dictionary mapping symbol to tick list
        """
        if end_time is None:
            end_time = datetime.now()
        if start_time is None:
            start_time = end_time - timedelta(hours=1)
        
        results = {}
        
        # Try cache first for all symbols
        cached = await tick_redis_cache.get_latest_ticks_batch(symbols)
        
        for symbol in symbols:
            if cached.get(symbol):
                results[symbol] = [cached[symbol]]
            else:
                # Get from database
                try:
                    ticks = await tick_history_db.get_ticks_by_time_range(
                        symbol, start_time, end_time, limit=limit_per_symbol, offset=0
                    )
                    results[symbol] = ticks
                    
                    # Cache latest if available
                    if ticks:
                        await cache_tick(symbol, ticks[-1])
                        
                except Exception as e:
                    logger.error(f"Failed to get ticks for {symbol}: {e}")
                    results[symbol] = []
        
        return results
    
    @staticmethod
    async def get_tick_volume_summary(
        symbol: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get volume summary for a symbol over multiple days.
        
        Args:
            symbol: Stock symbol
            days: Number of days to analyze
            
        Returns:
            Volume summary statistics
        """
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        
        try:
            # Daily aggregation
            rows = await Database.fetch(
                """
                SELECT 
                    DATE(tick_time) as date,
                    COUNT(*) as tick_count,
                    SUM(volume) as total_volume,
                    SUM(amount) as total_amount,
                    AVG(price) as avg_price,
                    MIN(price) as min_price,
                    MAX(price) as max_price
                FROM stock_tick_history
                WHERE symbol = $1
                  AND tick_time >= $2
                  AND tick_time <= $3
                GROUP BY DATE(tick_time)
                ORDER BY date DESC
                """,
                symbol, start_time, end_time
            )
            
            daily_data = [
                {
                    'date': str(r['date']),
                    'tick_count': r['tick_count'],
                    'total_volume': r['total_volume'],
                    'total_amount': float(r['total_amount']) if r['total_amount'] else 0,
                    'avg_price': float(r['avg_price']) if r['avg_price'] else 0,
                    'min_price': float(r['min_price']) if r['min_price'] else 0,
                    'max_price': float(r['max_price']) if r['max_price'] else 0,
                }
                for r in rows
            ]
            
            # Calculate totals
            total_ticks = sum(d['tick_count'] for d in daily_data)
            total_volume = sum(d['total_volume'] for d in daily_data)
            total_amount = sum(d['total_amount'] for d in daily_data)
            
            return {
                'symbol': symbol,
                'days_analyzed': days,
                'daily_data': daily_data,
                'summary': {
                    'total_ticks': total_ticks,
                    'total_volume': total_volume,
                    'total_amount': total_amount,
                    'avg_daily_ticks': total_ticks / len(daily_data) if daily_data else 0,
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get volume summary for {symbol}: {e}")
            return {
                'symbol': symbol,
                'days_analyzed': days,
                'daily_data': [],
                'summary': {}
            }
    
    @staticmethod
    async def search_ticks_by_price_range(
        symbol: str,
        min_price: float,
        max_price: float,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict]:
        """Search ticks within a price range.
        
        Args:
            symbol: Stock symbol
            min_price: Minimum price
            max_price: Maximum price
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum results
            
        Returns:
            List of matching ticks
        """
        if end_time is None:
            end_time = datetime.now()
        if start_time is None:
            start_time = end_time - timedelta(days=1)
        
        try:
            rows = await Database.fetch(
                """
                SELECT *
                FROM stock_tick_history
                WHERE symbol = $1
                  AND tick_time >= $2
                  AND tick_time <= $3
                  AND price >= $4
                  AND price <= $5
                ORDER BY tick_time DESC
                LIMIT $6
                """,
                symbol, start_time, end_time, min_price, max_price, limit
            )
            
            return [dict(r) for r in rows]
            
        except Exception as e:
            logger.error(f"Failed to search ticks for {symbol}: {e}")
            return []
    
    @staticmethod
    async def get_collection_health(
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get overall collection health status.
        
        Args:
            hours: Hours to analyze
            
        Returns:
            Health status dictionary
        """
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        try:
            # Get overall stats
            row = await Database.fetchrow(
                """
                SELECT 
                    COUNT(DISTINCT symbol) as symbols_with_data,
                    COUNT(*) as total_ticks,
                    AVG(price) as avg_price,
                    MIN(tick_time) as earliest_tick,
                    MAX(tick_time) as latest_tick
                FROM stock_tick_history
                WHERE tick_time >= $1
                """,
                start_time
            )
            
            # Get symbols without recent data
            no_data_rows = await Database.fetch(
                """
                SELECT DISTINCT w.symbol
                FROM watchlist_items w
                LEFT JOIN stock_tick_history t ON w.symbol = t.symbol 
                    AND t.tick_time >= $1
                WHERE w.market IN ('AShare', 'SSE', 'SZSE')
                  AND t.symbol IS NULL
                LIMIT 100
                """,
                start_time
            )
            
            # Get top symbols by tick count
            top_rows = await Database.fetch(
                """
                SELECT 
                    symbol,
                    COUNT(*) as tick_count
                FROM stock_tick_history
                WHERE tick_time >= $1
                GROUP BY symbol
                ORDER BY tick_count DESC
                LIMIT 10
                """,
                start_time
            )
            
            return {
                'period_hours': hours,
                'symbols_with_data': row['symbols_with_data'] if row else 0,
                'total_ticks': row['total_ticks'] if row else 0,
                'avg_price': float(row['avg_price']) if row and row['avg_price'] else 0,
                'earliest_tick': row['earliest_tick'].isoformat() if row and row['earliest_tick'] else None,
                'latest_tick': row['latest_tick'].isoformat() if row and row['latest_tick'] else None,
                'symbols_without_data': [r['symbol'] for r in no_data_rows],
                'top_symbols': [
                    {'symbol': r['symbol'], 'tick_count': r['tick_count']}
                    for r in top_rows
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection health: {e}")
            return {'error': str(e)}


# Global service instance
tick_history_service = TickHistoryService()
