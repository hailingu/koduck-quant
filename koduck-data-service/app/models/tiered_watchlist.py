"""Tiered watchlist models for layered stock data architecture.

This module defines the data models for the tiered watchlist system:
- Track Layer: 100 stocks, real-time updates via WebSocket
- Watch Layer: 1500 stocks, 1-minute kline, background async updates
"""

from datetime import datetime
from enum import IntEnum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class TrackingLevel(str):
    """Tracking level for watchlist items."""
    TRACK = "TRACK"  # 盯盘层 - 实时更新
    WATCH = "WATCH"  # 观察层 - 异步更新


class Priority(IntEnum):
    """Priority levels for update queue."""
    TRACK_REALTIME = 0      # 盯盘层实时更新（最高）
    TRACK_BATCH = 1         # 盯盘层批量更新
    WATCH_KLINE_1M = 2      # 观察层1分钟K线
    WATCH_KLINE_5M = 3      # 观察层5分钟K线
    FULL_SYNC = 4           # 全量同步（最低）


class TrackStockData(BaseModel):
    """Real-time track layer stock data.
    
    Attributes:
        symbol: Stock symbol
        price: Latest price
        change_percent: Price change percentage
        bid_price: Best bid price
        ask_price: Best ask price
        volume: Trading volume
        timestamp: Data timestamp
    """
    symbol: str = Field(..., description="Stock symbol")
    price: float = Field(..., description="Latest price")
    change_percent: float = Field(..., description="Price change percentage")
    bid_price: Optional[float] = Field(default=None, description="Best bid price")
    ask_price: Optional[float] = Field(default=None, description="Best ask price")
    bid_volume: Optional[int] = Field(default=None, description="Best bid volume")
    ask_volume: Optional[int] = Field(default=None, description="Best ask volume")
    volume: Optional[int] = Field(default=None, description="Trading volume")
    amount: Optional[float] = Field(default=None, description="Trading amount")
    timestamp: int = Field(..., description="Unix timestamp")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "symbol": "601012",
                "price": 18.12,
                "change_percent": -1.09,
                "bid_price": 18.10,
                "ask_price": 18.15,
                "volume": 125800,
                "timestamp": 1772471234
            }
        }
    }


class WatchKlineData(BaseModel):
    """1-minute kline data for watch layer.
    
    Attributes:
        symbol: Stock symbol
        timestamp: Kline timestamp
        open: Opening price
        high: Highest price
        low: Lowest price
        close: Closing price
        volume: Trading volume
    """
    symbol: str = Field(..., description="Stock symbol")
    timestamp: int = Field(..., description="Unix timestamp")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    volume: int = Field(..., description="Trading volume")
    amount: Optional[float] = Field(default=None, description="Trading amount")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "symbol": "601012",
                "timestamp": 1772470800,
                "open": 18.20,
                "high": 18.25,
                "low": 18.15,
                "close": 18.12,
                "volume": 15000
            }
        }
    }


class UserTrackingConfig(BaseModel):
    """User tracking configuration.
    
    Attributes:
        user_id: User ID
        max_track_stocks: Maximum track layer stocks (default 100)
        max_watch_stocks: Maximum watch layer stocks (default 1500)
        track_update_interval: Track layer update interval in seconds (default 10)
    """
    user_id: int = Field(..., description="User ID")
    max_track_stocks: int = Field(default=100, description="Max track stocks")
    max_watch_stocks: int = Field(default=1500, description="Max watch stocks")
    track_update_interval: int = Field(default=10, description="Track update interval (seconds)")
    created_at: Optional[datetime] = Field(default=None, description="Created time")
    updated_at: Optional[datetime] = Field(default=None, description="Updated time")


class WatchlistItem(BaseModel):
    """Watchlist item with tracking level.
    
    Attributes:
        id: Item ID
        user_id: User ID
        symbol: Stock symbol
        name: Stock name
        tracking_level: Tracking level (TRACK/WATCH)
        created_at: Created time
        updated_at: Updated time
    """
    id: Optional[int] = Field(default=None, description="Item ID")
    user_id: int = Field(..., description="User ID")
    symbol: str = Field(..., description="Stock symbol")
    name: Optional[str] = Field(default=None, description="Stock name")
    tracking_level: str = Field(default=TrackingLevel.WATCH, description="TRACK or WATCH")
    created_at: Optional[datetime] = Field(default=None, description="Created time")
    updated_at: Optional[datetime] = Field(default=None, description="Updated time")


class TieredWatchlistResponse(BaseModel):
    """Tiered watchlist API response.
    
    Attributes:
        track_layer: Track layer stocks (real-time data)
        watch_layer: Watch layer stocks (1-min kline data)
        track_count: Number of track layer stocks
        watch_count: Number of watch layer stocks
        watch_update_status: Watch layer data freshness status
    """
    track_layer: List[TrackStockData] = Field(default=[], description="Track layer stocks")
    watch_layer: List[WatchKlineData] = Field(default=[], description="Watch layer stocks")
    track_count: int = Field(default=0, description="Track layer count")
    watch_count: int = Field(default=0, description="Watch layer count")
    watch_update_status: Dict[str, Any] = Field(
        default={"total": 0, "fresh": 0, "stale": 0},
        description="Watch layer freshness status"
    )


class UpdateTask(BaseModel):
    """Update task for priority queue.
    
    Attributes:
        priority: Task priority
        symbols: List of stock symbols to update
        task_type: Type of update task
        created_at: Task creation time
    """
    priority: Priority = Field(..., description="Task priority")
    symbols: List[str] = Field(..., description="Stock symbols")
    task_type: str = Field(..., description="Task type")
    created_at: datetime = Field(default_factory=datetime.now, description="Created time")
    
    # For priority queue comparison
    def __lt__(self, other):
        return self.priority < other.priority


class WebSocketMessage(BaseModel):
    """WebSocket message for track layer updates.
    
    Attributes:
        type: Message type
        symbol: Stock symbol
        data: Stock data payload
        timestamp: Message timestamp
    """
    type: str = Field(default="track_update", description="Message type")
    symbol: str = Field(..., description="Stock symbol")
    data: TrackStockData = Field(..., description="Stock data")
    timestamp: int = Field(..., description="Unix timestamp")


class DataFreshnessStatus(BaseModel):
    """Data freshness status for watch layer.
    
    Attributes:
        symbol: Stock symbol
        last_updated: Last update timestamp
        is_fresh: Whether data is fresh (< 2 minutes old)
        age_seconds: Data age in seconds
    """
    symbol: str = Field(..., description="Stock symbol")
    last_updated: int = Field(..., description="Last update timestamp")
    is_fresh: bool = Field(..., description="Is data fresh")
    age_seconds: int = Field(..., description="Data age in seconds")
