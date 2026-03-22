"""History Playback API routes.

Issue #204: History Playback API - 历史行情回放
Provides historical market data for playback functionality.
"""

import logging
import random
from typing import List, Optional, Dict
from datetime import datetime, date, timedelta, timezone
from enum import Enum

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/market/history", tags=["history-playback"])


# ============================================================================
# Models
# ============================================================================

class IndexSnapshot(BaseModel):
    """Index snapshot data."""
    symbol: str = Field(..., description="Index symbol")
    name: str = Field(..., description="Index name")
    price: float = Field(..., description="Current price")
    change: float = Field(..., description="Price change")
    change_percent: float = Field(..., description="Price change percentage")
    volume: int = Field(..., description="Trading volume")


class StockLeader(BaseModel):
    """Leading stock data."""
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    price: float = Field(..., description="Current price")
    change: float = Field(..., description="Price change")
    change_percent: float = Field(..., description="Change percentage")
    sector: str = Field(..., description="Industry sector")


class MarketBreadthSnapshot(BaseModel):
    """Market breadth snapshot."""
    gainers: int = Field(..., description="Number of gaining stocks")
    losers: int = Field(..., description="Number of losing stocks")
    unchanged: int = Field(..., description="Number of unchanged stocks")
    limit_up: int = Field(..., description="Number of limit-up stocks")
    limit_down: int = Field(..., description="Number of limit-down stocks")


class MarketSnapshot(BaseModel):
    """Complete market snapshot at a specific time."""
    timestamp: str = Field(..., description="Snapshot timestamp")
    date: str = Field(..., description="Trading date")
    time: str = Field(..., description="Trading time")
    indices: List[IndexSnapshot] = Field(..., description="Major indices")
    leaders: List[StockLeader] = Field(..., description="Top gaining stocks")
    laggards: List[StockLeader] = Field(..., description="Top losing stocks")
    breadth: MarketBreadthSnapshot = Field(..., description="Market breadth stats")
    total_volume: float = Field(..., description="Total market volume")
    total_amount: float = Field(..., description="Total market amount")


class TimeSeriesPoint(BaseModel):
    """Single time series data point."""
    timestamp: str = Field(..., description="ISO timestamp")
    time: str = Field(..., description="Time string HH:MM")
    sh_index: float = Field(..., description="Shanghai Composite")
    sz_index: float = Field(..., description="Shenzhen Component")
    cy_index: float = Field(..., description="ChiNext Index")
    volume: float = Field(..., description="Total volume")


class TimeSeriesResponse(BaseModel):
    """Time series data for playback."""
    date: str = Field(..., description="Trading date")
    interval: str = Field(..., description="Data interval")
    data: List[TimeSeriesPoint] = Field(..., description="Time series points")
    total_points: int = Field(..., description="Total number of points")


class AvailableDate(BaseModel):
    """Available trading date."""
    date: str = Field(..., description="Date string")
    weekday: str = Field(..., description="Day of week")
    has_data: bool = Field(..., description="Whether data is available")


# ============================================================================
# Mock Data Generators
# ============================================================================

def generate_indices_snapshot(date_seed: int) -> List[IndexSnapshot]:
    """Generate index snapshot data."""
    random.seed(date_seed)
    
    indices = [
        {"symbol": "000001.SH", "name": "上证指数"},
        {"symbol": "399001.SZ", "name": "深证成指"},
        {"symbol": "399006.SZ", "name": "创业板指"},
        {"symbol": "000016.SH", "name": "上证50"},
        {"symbol": "000300.SH", "name": "沪深300"},
    ]
    
    base_values = [2850, 9500, 1850, 2350, 3450]
    
    result = []
    for idx, base in zip(indices, base_values):
        change_percent = random.uniform(-2.5, 2.5)
        price = base * (1 + change_percent / 100)
        change = price - base
        
        result.append(IndexSnapshot(
            symbol=idx["symbol"],
            name=idx["name"],
            price=round(price, 2),
            change=round(change, 2),
            change_percent=round(change_percent, 2),
            volume=random.randint(100000000, 500000000)
        ))
    
    return result


def generate_stock_leaders(date_seed: int, is_gain: bool = True) -> List[StockLeader]:
    """Generate leading/lagging stocks."""
    random.seed(date_seed + (1 if is_gain else 2))
    
    stocks = [
        {"symbol": "600519", "name": "贵州茅台", "sector": "白酒"},
        {"symbol": "000858", "name": "五粮液", "sector": "白酒"},
        {"symbol": "300750", "name": "宁德时代", "sector": "新能源"},
        {"symbol": "002594", "name": "比亚迪", "sector": "汽车"},
        {"symbol": "600036", "name": "招商银行", "sector": "银行"},
        {"symbol": "000333", "name": "美的集团", "sector": "家电"},
        {"symbol": "601012", "name": "隆基绿能", "sector": "光伏"},
        {"symbol": "300760", "name": "迈瑞医疗", "sector": "医疗器械"},
    ]
    
    result = []
    for stock in stocks[:5]:
        if is_gain:
            change_percent = random.uniform(3, 10)
        else:
            change_percent = random.uniform(-10, -3)
        
        price = random.uniform(50, 2000)
        
        result.append(StockLeader(
            symbol=stock["symbol"],
            name=stock["name"],
            price=round(price, 2),
            change=round(price * change_percent / 100, 2),
            change_percent=round(change_percent, 2),
            sector=stock["sector"]
        ))
    
    # Sort by change percent
    result.sort(key=lambda x: x.change_percent, reverse=is_gain)
    
    return result


def generate_breadth(date_seed: int) -> MarketBreadthSnapshot:
    """Generate market breadth data."""
    random.seed(date_seed + 3)
    
    total = 5000
    gainers = random.randint(1500, 3000)
    losers = random.randint(1000, 2500)
    unchanged = total - gainers - losers
    
    return MarketBreadthSnapshot(
        gainers=gainers,
        losers=losers,
        unchanged=max(0, unchanged),
        limit_up=random.randint(20, 80),
        limit_down=random.randint(5, 30)
    )


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/dates", response_model=ApiResponse[List[AvailableDate]])
async def get_available_dates(
    days: int = Query(30, ge=1, le=90, description="Number of days to return")
):
    """Get list of available trading dates for history playback.
    
    Issue #204: Returns recent trading dates with data availability status.
    
    Args:
        days: Number of days to return (1-90)
        
    Returns:
        List of available dates with metadata.
    """
    try:
        dates = []
        today = date.today()
        weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        
        for i in range(days):
            check_date = today - timedelta(days=i)
            
            # Skip weekends (simplified, doesn't account for holidays)
            if check_date.weekday() >= 5:
                continue
            
            dates.append(AvailableDate(
                date=check_date.isoformat(),
                weekday=weekdays[check_date.weekday()],
                has_data=True  # Mock: all dates have data
            ))
        
        return ApiResponse(code=200, message="success", data=dates)
        
    except Exception as e:
        logger.error(f"Failed to get available dates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/snapshot", response_model=ApiResponse[MarketSnapshot])
async def get_market_snapshot(
    date: str = Query(..., description="Trading date (YYYY-MM-DD)"),
    time: str = Query(..., description="Time (HH:MM)")
):
    """Get market snapshot at a specific date and time.
    
    Issue #204: Returns complete market state including indices, leaders, and breadth.
    
    Args:
        date: Trading date in YYYY-MM-DD format
        time: Time in HH:MM format
        
    Returns:
        MarketSnapshot with complete market state.
    """
    try:
        # Validate date format
        snapshot_date = datetime.strptime(date, "%Y-%m-%d").date()
        datetime.strptime(time, "%H:%M")  # Validate time format
        
        # Generate consistent seed from date
        date_seed = int(snapshot_date.strftime("%Y%m%d")) + int(time.replace(":", ""))
        
        indices = generate_indices_snapshot(date_seed)
        leaders = generate_stock_leaders(date_seed, is_gain=True)
        laggards = generate_stock_leaders(date_seed, is_gain=False)
        breadth = generate_breadth(date_seed)
        
        snapshot = MarketSnapshot(
            timestamp=f"{date}T{time}:00Z",
            date=date,
            time=time,
            indices=indices,
            leaders=leaders,
            laggards=laggards,
            breadth=breadth,
            total_volume=random.uniform(80000000000, 120000000000),
            total_amount=random.uniform(800000000000, 1200000000000)
        )
        
        return ApiResponse(code=200, message="success", data=snapshot)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/time format: {e}")
    except Exception as e:
        logger.error(f"Failed to get market snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timeseries", response_model=ApiResponse[TimeSeriesResponse])
async def get_time_series(
    date: str = Query(..., description="Trading date (YYYY-MM-DD)"),
    interval: str = Query("5m", description="Data interval: 1m, 5m, 15m, 30m, 1h")
):
    """Get time series data for history playback.
    
    Issue #204: Returns sequential market data points for playback.
    
    Args:
        date: Trading date in YYYY-MM-DD format
        interval: Data interval (1m, 5m, 15m, 30m, 1h)
        
    Returns:
        TimeSeriesResponse with sequential data points.
    """
    try:
        # Validate date
        trade_date = datetime.strptime(date, "%Y-%m-%d").date()
        date_seed = int(trade_date.strftime("%Y%m%d"))
        random.seed(date_seed)
        
        # Parse interval
        interval_minutes = {
            "1m": 1,
            "5m": 5,
            "15m": 15,
            "30m": 30,
            "1h": 60
        }.get(interval, 5)
        
        # Trading hours: 09:30 - 11:30, 13:00 - 15:00
        # Generate data points
        data_points = []
        
        # Morning session: 09:30 - 11:30
        current_time = datetime.combine(trade_date, datetime.strptime("09:30", "%H:%M").time())
        morning_end = datetime.combine(trade_date, datetime.strptime("11:30", "%H:%M").time())
        
        base_sh = 2850
        base_sz = 9500
        base_cy = 1850
        
        while current_time <= morning_end:
            time_str = current_time.strftime("%H:%M")
            
            # Generate random walk
            sh_change = random.uniform(-5, 5)
            sz_change = random.uniform(-15, 15)
            cy_change = random.uniform(-5, 5)
            
            base_sh += sh_change
            base_sz += sz_change
            base_cy += cy_change
            
            data_points.append(TimeSeriesPoint(
                timestamp=current_time.isoformat(),
                time=time_str,
                sh_index=round(base_sh, 2),
                sz_index=round(base_sz, 2),
                cy_index=round(base_cy, 2),
                volume=random.uniform(1000000000, 5000000000)
            ))
            
            current_time += timedelta(minutes=interval_minutes)
        
        # Afternoon session: 13:00 - 15:00
        current_time = datetime.combine(trade_date, datetime.strptime("13:00", "%H:%M").time())
        afternoon_end = datetime.combine(trade_date, datetime.strptime("15:00", "%H:%M").time())
        
        while current_time <= afternoon_end:
            time_str = current_time.strftime("%H:%M")
            
            sh_change = random.uniform(-5, 5)
            sz_change = random.uniform(-15, 15)
            cy_change = random.uniform(-5, 5)
            
            base_sh += sh_change
            base_sz += sz_change
            base_cy += cy_change
            
            data_points.append(TimeSeriesPoint(
                timestamp=current_time.isoformat(),
                time=time_str,
                sh_index=round(base_sh, 2),
                sz_index=round(base_sz, 2),
                cy_index=round(base_cy, 2),
                volume=random.uniform(1000000000, 5000000000)
            ))
            
            current_time += timedelta(minutes=interval_minutes)
        
        random.seed()  # Reset seed
        
        return ApiResponse(
            code=200,
            message="success",
            data=TimeSeriesResponse(
                date=date,
                interval=interval,
                data=data_points,
                total_points=len(data_points)
            )
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        logger.error(f"Failed to get time series: {e}")
        raise HTTPException(status_code=500, detail=str(e))
