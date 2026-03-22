"""
Time & Sales (逐笔成交) data API
Issues: #213

Limitation: A-share Level-1 only provides 3-5s snapshots
True tick-by-tick data requires Level-2 (high cost)
"""

from datetime import datetime, time
from enum import Enum
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import random

router = APIRouter(tags=["tick"], prefix="/api/v1/market")


class TickType(str, Enum):
    BUY = "buy"
    SELL = "sell"


class TickFlag(str, Enum):
    NORMAL = "NORMAL"
    BLOCK_ORDER = "BLOCK_ORDER"  # 大单
    ICEBERG = "ICEBERG"  # 冰山单


class TickResponse(BaseModel):
    time: str  # HH:mm:ss
    price: float
    size: int
    amount: float
    type: TickType
    flag: TickFlag
    
    class Config:
        json_schema_extra = {
            "example": {
                "time": "10:30:15",
                "price": 1650.00,
                "size": 100,
                "amount": 165000.00,
                "type": "buy",
                "flag": "BLOCK_ORDER"
            }
        }


def is_trading_time() -> bool:
    """Check if current time is within A-share trading hours"""
    now = datetime.now().time()
    morning_start = time(9, 30)
    morning_end = time(11, 30)
    afternoon_start = time(13, 0)
    afternoon_end = time(15, 0)
    
    return (
        (morning_start <= now <= morning_end) or
        (afternoon_start <= now <= afternoon_end)
    )


def generate_mock_ticks(symbol: str, limit: int = 50) -> List[TickResponse]:
    """
    Generate mock tick data for demonstration purposes.
    
    In production with Level-2 data, this would be replaced with:
    - Direct exchange data feed
    - Proper tick-by-tick reconstruction
    """
    ticks = []
    base_price = 1650.0 if "600519" in symbol else random.uniform(10, 100)
    current_time = datetime.now()
    
    for i in range(limit):
        # Generate realistic price movement
        price_change = random.gauss(0, 0.01) * base_price
        price = round(base_price + price_change, 2)
        
        # Generate size (lot = 100 shares for A-shares)
        size = random.choice([100, 200, 300, 500, 800, 1000, 2000, 5000])
        
        # Calculate amount
        amount = round(price * size, 2)
        
        # Determine tick type (slightly more buys in uptrend)
        tick_type = TickType.BUY if random.random() > 0.45 else TickType.SELL
        
        # Determine flag based on size
        if size >= 5000:
            flag = TickFlag.BLOCK_ORDER
        elif size <= 100 and random.random() > 0.7:
            flag = TickFlag.ICEBERG
        else:
            flag = TickFlag.NORMAL
        
        # Generate time (going backwards)
        tick_time = current_time.replace(
            second=(current_time.second - i * 3) % 60,
            minute=current_time.minute - (i * 3 // 60)
        )
        time_str = tick_time.strftime("%H:%M:%S")
        
        ticks.append(TickResponse(
            time=time_str,
            price=price,
            size=size,
            amount=amount,
            type=tick_type,
            flag=flag
        ))
    
    return ticks


@router.get("/ticks", response_model=List[TickResponse])
async def get_tick_data(
    market: str = Query(..., description="Market code: SH, SZ, HK, US"),
    symbol: str = Query(..., description="Stock symbol/code"),
    limit: int = Query(50, ge=1, le=200, description="Number of ticks to return")
):
    """
    Get Time & Sales (逐笔成交) tick data for a symbol.
    
    **Note**: A-share Level-1 market data only provides 3-5 second snapshots.
    True tick-by-tick data requires Level-2 data authorization (high cost).
    This endpoint currently returns simulated tick data based on snapshots.
    
    **Trading Hours** (China A-share):
    - Morning: 09:30 - 11:30
    - Afternoon: 13:00 - 15:00
    
    **Response Fields**:
    - `time`: Transaction time (HH:mm:ss)
    - `price`: Transaction price
    - `size`: Transaction volume (shares)
    - `amount`: Transaction amount (CNY)
    - `type`: Transaction type - "buy" or "sell"
    - `flag`: Transaction flag - "NORMAL", "BLOCK_ORDER" (大单), or "ICEBERG"
    """
    # Validate market
    valid_markets = ["SH", "SZ", "HK", "US"]
    if market.upper() not in valid_markets:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid market. Must be one of: {', '.join(valid_markets)}"
        )
    
    # Generate mock tick data
    # In production, this would query actual tick database
    ticks = generate_mock_ticks(symbol, limit)
    
    return ticks


@router.get("/ticks/stream")
async def stream_tick_data(
    market: str = Query(..., description="Market code"),
    symbol: str = Query(..., description="Stock symbol/code")
):
    """
    WebSocket endpoint for real-time tick streaming.
    
    **Note**: This is a placeholder for future WebSocket implementation.
    When Level-2 data is available, this will stream true tick-by-tick updates.
    """
    raise HTTPException(
        status_code=501,
        detail="WebSocket streaming not yet implemented. Use polling endpoint instead."
    )


@router.get("/ticks/summary")
async def get_tick_summary(
    market: str = Query(..., description="Market code"),
    symbol: str = Query(..., description="Stock symbol/code")
):
    """
    Get summary statistics of tick data for today.
    """
    # Generate mock summary
    return {
        "symbol": symbol,
        "market": market,
        "totalTrades": random.randint(10000, 100000),
        "totalVolume": random.randint(1000000, 10000000),
        "totalAmount": round(random.uniform(100000000, 1000000000), 2),
        "buyVolume": random.randint(400000, 6000000),
        "sellVolume": random.randint(400000, 6000000),
        "blockOrderCount": random.randint(100, 1000),
        "avgTradeSize": random.randint(100, 500),
        "lastUpdated": datetime.now().isoformat()
    }
