"""Dashboard API routes.

Provides endpoints for Dashboard components:
- Fear/Greed Index (#199)
- Sector Flow (#200)
- Market Breadth (#201)
- Big Order Alert (#202)
"""

import logging
import random
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/market", tags=["dashboard"])


# ============================================================================
# #199 Fear/Greed Index Models and Endpoints
# ============================================================================

class FearGreedLevel(str, Enum):
    """Fear/Greed index levels."""
    EXTREME_FEAR = "Extreme Fear"
    FEAR = "Fear"
    NEUTRAL = "Neutral"
    GREED = "Greed"
    EXTREME_GREED = "Extreme Greed"


class FearGreedIndex(BaseModel):
    """Fear/Greed Index response model."""
    value: int = Field(..., ge=0, le=100, description="Index value 0-100")
    label: str = Field(..., description="Index label")
    prev_value: int = Field(..., description="Previous day value")
    change: int = Field(..., description="Change from previous day")
    timestamp: str = Field(..., description="ISO timestamp")
    components: dict = Field(default={}, description="Component breakdown")


def calculate_fear_greed_level(value: int) -> str:
    """Convert index value to label."""
    if value <= 20:
        return FearGreedLevel.EXTREME_FEAR
    elif value <= 40:
        return FearGreedLevel.FEAR
    elif value <= 60:
        return FearGreedLevel.NEUTRAL
    elif value <= 80:
        return FearGreedLevel.GREED
    else:
        return FearGreedLevel.EXTREME_GREED


@router.get("/fear-greed-index", response_model=ApiResponse[FearGreedIndex])
async def get_fear_greed_index():
    """Get Fear/Greed Index for market sentiment analysis.
    
    Returns a 0-100 index where:
    - 0-20: Extreme Fear
    - 21-40: Fear
    - 41-60: Neutral
    - 61-80: Greed
    - 81-100: Extreme Greed
    
    The index is calculated based on:
    - Market volatility (25%)
    - Market momentum (25%)
    - Trading volume (20%)
    - Market breadth (15%)
    - Northbound flow (15%)
    """
    try:
        # TODO: Replace with actual calculation from real data
        # For now, generate realistic mock data
        base_value = 64
        variation = random.randint(-5, 5)
        value = max(0, min(100, base_value + variation))
        prev_value = value + random.randint(-3, 3)
        
        # Calculate components
        components = {
            "volatility": random.randint(40, 80),
            "momentum": random.randint(50, 90),
            "volume": random.randint(45, 85),
            "breadth": random.randint(40, 75),
            "northbound": random.randint(35, 70)
        }
        
        result = FearGreedIndex(
            value=value,
            label=calculate_fear_greed_level(value),
            prev_value=prev_value,
            change=value - prev_value,
            timestamp=datetime.now(timezone.utc).isoformat(),
            components=components
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get fear/greed index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# #200 Sector Flow Models and Endpoints
# ============================================================================

class SectorFlowItem(BaseModel):
    """Individual sector flow data."""
    name: str = Field(..., description="Sector name")
    code: str = Field(..., description="Sector code")
    inflow: float = Field(default=0, description="Inflow amount")
    outflow: float = Field(default=0, description="Outflow amount")
    net_flow: float = Field(..., description="Net flow (inflow - outflow)")
    change: float = Field(..., description="Change percentage")
    market_cap: float = Field(default=0, description="Total market cap")
    leading_stocks: List[str] = Field(default=[], description="Top gaining stocks")


class SectorFlowResponse(BaseModel):
    """Sector flow response model."""
    total_inflow: float = Field(..., description="Total market inflow")
    total_outflow: float = Field(..., description="Total market outflow")
    net_flow: float = Field(..., description="Net market flow")
    sectors: List[SectorFlowItem] = Field(..., description="Sector details")
    timestamp: str = Field(..., description="ISO timestamp")


# Mock sector data
SECTOR_MOCK_DATA = [
    {"name": "科技", "code": "TECH", "inflow": 12.5, "outflow": 3.2, "change": 0.028},
    {"name": "金融", "code": "FINANCE", "inflow": 28.3, "outflow": 5.1, "change": 0.045},
    {"name": "能源", "code": "ENERGY", "inflow": 4.2, "outflow": 8.5, "change": -0.032},
    {"name": "医药", "code": "HEALTHCARE", "inflow": 6.8, "outflow": 4.2, "change": 0.015},
    {"name": "消费", "code": "CONSUMER", "inflow": 9.1, "outflow": 6.3, "change": 0.022},
    {"name": "工业", "code": "INDUSTRIAL", "inflow": 7.5, "outflow": 5.8, "change": 0.012},
    {"name": "材料", "code": "MATERIALS", "inflow": 5.2, "outflow": 4.1, "change": 0.018},
    {"name": "房地产", "code": "REAL_ESTATE", "inflow": 2.1, "outflow": 7.3, "change": -0.045},
]


@router.get("/sector-flow", response_model=ApiResponse[SectorFlowResponse])
async def get_sector_flow(
    sort_by: Optional[str] = Query("net_flow", description="Sort by: net_flow, inflow, outflow, change"),
    limit: int = Query(10, ge=1, le=20, description="Number of sectors to return")
):
    """Get sector capital flow data for Capital River component.
    
    Returns inflow/outflow data for all major sectors.
    """
    try:
        # Build sector list
        sectors = []
        total_inflow = 0
        total_outflow = 0
        
        for sector_data in SECTOR_MOCK_DATA[:limit]:
            inflow = sector_data["inflow"] * 100000000  # Convert to actual amount
            outflow = sector_data["outflow"] * 100000000
            net_flow = inflow - outflow
            
            total_inflow += inflow
            total_outflow += outflow
            
            sectors.append(SectorFlowItem(
                name=sector_data["name"],
                code=sector_data["code"],
                inflow=inflow,
                outflow=outflow,
                net_flow=net_flow,
                change=sector_data["change"],
                market_cap=random.randint(500, 5000) * 100000000,
                leading_stocks=[f"STOCK{i}" for i in range(random.randint(2, 5))]
            ))
        
        # Sort by specified field
        if sort_by == "net_flow":
            sectors.sort(key=lambda x: abs(x.net_flow), reverse=True)
        elif sort_by == "inflow":
            sectors.sort(key=lambda x: x.inflow, reverse=True)
        elif sort_by == "outflow":
            sectors.sort(key=lambda x: x.outflow, reverse=True)
        elif sort_by == "change":
            sectors.sort(key=lambda x: x.change, reverse=True)
        
        result = SectorFlowResponse(
            total_inflow=total_inflow,
            total_outflow=total_outflow,
            net_flow=total_inflow - total_outflow,
            sectors=sectors,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get sector flow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# #201 Market Breadth Models and Endpoints
# ============================================================================

class PriceRangeDistribution(BaseModel):
    """Price change distribution for a range."""
    range: str = Field(..., description="Price change range")
    count: int = Field(..., description="Number of stocks in range")
    percentage: float = Field(..., description="Percentage of total")


class MarketBreadthResponse(BaseModel):
    """Market breadth response model."""
    total_stocks: int = Field(..., description="Total number of stocks")
    gainers: int = Field(..., description="Number of gaining stocks")
    losers: int = Field(..., description="Number of losing stocks")
    unchanged: int = Field(..., description="Number of unchanged stocks")
    gainers_percentage: float = Field(..., description="Percentage of gainers")
    losers_percentage: float = Field(..., description="Percentage of losers")
    distribution: List[PriceRangeDistribution] = Field(..., description="Price change distribution")
    advance_decline_line: int = Field(..., description="Advance/decline line value")
    new_highs: int = Field(..., description="Number of stocks at 52-week high")
    new_lows: int = Field(..., description="Number of stocks at 52-week low")
    timestamp: str = Field(..., description="ISO timestamp")


@router.get("/breadth", response_model=ApiResponse[MarketBreadthResponse])
async def get_market_breadth():
    """Get market breadth statistics for Market Breadth Heatmap.
    
    Returns distribution of stock price changes across the market.
    """
    try:
        # TODO: Replace with actual market data
        # Mock data representing realistic market distribution
        total = 4657
        
        # Generate realistic distribution
        distribution_data = [
            (">+10%", random.randint(20, 50)),
            ("+7%~+10%", random.randint(80, 150)),
            ("+5%~+7%", random.randint(150, 280)),
            ("+3%~+5%", random.randint(300, 500)),
            ("+1%~+3%", random.randint(800, 1200)),
            ("-1%~+1%", random.randint(1000, 1400)),
            ("-3%~-1%", random.randint(600, 900)),
            ("-5%~-3%", random.randint(300, 500)),
            ("-7%~-5%", random.randint(150, 280)),
            ("-10%~-7%", random.randint(80, 150)),
            ("<-10%", random.randint(20, 50)),
        ]
        
        # Calculate totals
        gainers = sum(count for range_str, count in distribution_data if '+' in range_str and '-' not in range_str)
        losers = sum(count for range_str, count in distribution_data if '-' in range_str)
        unchanged = next((count for range_str, count in distribution_data if "-1%~+1%" in range_str), 1000)
        
        # Build distribution with percentages
        distribution = [
            PriceRangeDistribution(
                range=range_str,
                count=count,
                percentage=round(count / total * 100, 2)
            )
            for range_str, count in distribution_data
        ]
        
        result = MarketBreadthResponse(
            total_stocks=total,
            gainers=gainers,
            losers=losers,
            unchanged=unchanged,
            gainers_percentage=round(gainers / total * 100, 2),
            losers_percentage=round(losers / total * 100, 2),
            distribution=distribution,
            advance_decline_line=gainers - losers,
            new_highs=random.randint(30, 80),
            new_lows=random.randint(10, 40),
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get market breadth: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# #202 Big Order Alert Models and Endpoints
# ============================================================================

class BigOrderType(str, Enum):
    """Type of big order."""
    BLOCK_ORDER = "BLOCK ORDER"
    DARK_POOL = "DARK POOL"
    ICEBERG = "ICEBERG"
    SWEEPER = "SWEEPER"


class BigOrderAlert(BaseModel):
    """Big order alert item."""
    id: str = Field(..., description="Alert ID")
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    type: str = Field(..., description="Order type: buy/sell")
    amount: float = Field(..., description="Order amount")
    amount_formatted: str = Field(..., description="Formatted amount string")
    price: float = Field(..., description="Execution price")
    volume: int = Field(..., description="Number of shares")
    time: str = Field(..., description="Execution time")
    type_label: str = Field(..., description="Order type label")
    exchange: str = Field(..., description="Exchange where executed")
    urgency: str = Field(..., description="Urgency level")


class BigOrderStats(BaseModel):
    """Big order statistics."""
    total_count_24h: int = Field(..., description="Total alerts in 24h")
    total_volume_24h: float = Field(..., description="Total volume in 24h")
    buy_sell_ratio: float = Field(..., description="Buy/Sell ratio")
    top_sectors: List[dict] = Field(..., description="Top sectors by big order volume")


# Mock big order data
BIG_ORDER_MOCK_DATA = [
    {"symbol": "NVDA.US", "name": "NVIDIA Corp", "type": "buy", "amount": 2400000, "price": 485.50, "volume": 4943, "type_label": "BLOCK ORDER", "exchange": "NYSE", "urgency": "high"},
    {"symbol": "TSLA.US", "name": "Tesla Inc", "type": "sell", "amount": 1800000, "price": 245.30, "volume": 7338, "type_label": "DARK POOL", "exchange": "NASDAQ", "urgency": "medium"},
    {"symbol": "AAPL.US", "name": "Apple Inc", "type": "buy", "amount": 3200000, "price": 178.90, "volume": 17887, "type_label": "ICEBERG", "exchange": "NASDAQ", "urgency": "high"},
    {"symbol": "MSFT.US", "name": "Microsoft Corp", "type": "buy", "amount": 1500000, "price": 378.20, "volume": 3966, "type_label": "BLOCK ORDER", "exchange": "NASDAQ", "urgency": "medium"},
    {"symbol": "AMZN.US", "name": "Amazon.com Inc", "type": "sell", "amount": 2100000, "price": 145.80, "volume": 14403, "type_label": "SWEEPER", "exchange": "NASDAQ", "urgency": "high"},
    {"symbol": "GOOGL.US", "name": "Alphabet Inc", "type": "buy", "amount": 980000, "price": 142.60, "volume": 6872, "type_label": "DARK POOL", "exchange": "NASDAQ", "urgency": "low"},
    {"symbol": "META.US", "name": "Meta Platforms", "type": "sell", "amount": 1650000, "price": 325.40, "volume": 5071, "type_label": "BLOCK ORDER", "exchange": "NASDAQ", "urgency": "medium"},
    {"symbol": "AMD.US", "name": "AMD Inc", "type": "buy", "amount": 750000, "price": 128.90, "volume": 5818, "type_label": "ICEBERG", "exchange": "NASDAQ", "urgency": "high"},
]


def format_amount(amount: float) -> str:
    """Format amount to human readable string."""
    if amount >= 1000000:
        return f"${amount/1000000:.1f}M"
    elif amount >= 1000:
        return f"${amount/1000:.1f}K"
    return f"${amount:.0f}"


@router.get("/big-orders", response_model=ApiResponse[List[BigOrderAlert]])
async def get_big_orders(
    limit: int = Query(10, ge=1, le=50, description="Number of orders to return"),
    order_type: Optional[str] = Query(None, description="Filter by type: buy/sell"),
    min_amount: Optional[float] = Query(500000, description="Minimum order amount")
):
    """Get big order alerts for Block Order / Dark Pool / Iceberg detection.
    
    Returns recent large block trades and dark pool activity.
    Note: Currently uses mock data. Production requires Level-2 data access.
    """
    try:
        # Filter and process mock data
        orders = []
        for i, order_data in enumerate(BIG_ORDER_MOCK_DATA[:limit]):
            # Apply filters
            if order_type and order_data["type"] != order_type:
                continue
            if order_data["amount"] < min_amount:
                continue
            
            # Generate time (more recent first)
            minutes_ago = i * random.randint(3, 8)
            time_str = f"{14:02d}:{max(0, 30-minutes_ago):02d}:{random.randint(10, 59):02d}"
            
            orders.append(BigOrderAlert(
                id=f"bo_{int(datetime.now().timestamp())}_{i}",
                symbol=order_data["symbol"],
                name=order_data["name"],
                type=order_data["type"],
                amount=order_data["amount"],
                amount_formatted=format_amount(order_data["amount"]),
                price=order_data["price"],
                volume=order_data["volume"],
                time=time_str,
                type_label=order_data["type_label"],
                exchange=order_data["exchange"],
                urgency=order_data["urgency"]
            ))
        
        return ApiResponse(code=200, message="success", data=orders)
        
    except Exception as e:
        logger.error(f"Failed to get big orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/big-orders/stats", response_model=ApiResponse[BigOrderStats])
async def get_big_order_stats():
    """Get big order statistics summary."""
    try:
        # Calculate stats from mock data
        buy_count = sum(1 for o in BIG_ORDER_MOCK_DATA if o["type"] == "buy")
        sell_count = len(BIG_ORDER_MOCK_DATA) - buy_count
        
        result = BigOrderStats(
            total_count_24h=random.randint(150, 300),
            total_volume_24h=random.randint(500000000, 1500000000),
            buy_sell_ratio=round(buy_count / max(sell_count, 1), 2),
            top_sectors=[
                {"name": "TECH", "volume": 450000000},
                {"name": "FINANCE", "volume": 280000000},
                {"name": "HEALTHCARE", "volume": 150000000},
            ]
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get big order stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
