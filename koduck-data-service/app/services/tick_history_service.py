"""Tick history service for querying and managing historical tick data.

This module provides high-level operations for tick history data,
including queries, analytics, and maintenance operations.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from app.db import tick_history_db
from app.config import settings

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


# Global service instance
tick_history_service = TickHistoryService()
