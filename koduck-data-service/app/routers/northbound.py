"""Northbound Capital Flow API routes.

Issue #203: 北向资金流向 API
Provides endpoints for Shanghai/Shenzhen Stock Connect flow data.
"""

import logging
from typing import List, Optional
from datetime import datetime, date, timezone
from enum import Enum

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/market", tags=["northbound"])


# ============================================================================
# Models
# ============================================================================

class TradingPeriod(str, Enum):
    """Trading periods for northbound flow."""
    OPEN = "OPEN"
    MID_DAY = "MID-DAY"
    CLOSE = "CLOSE"


class PeriodFlow(BaseModel):
    """Flow data for a specific trading period."""
    name: str = Field(..., description="Period name")
    inflow: float = Field(..., description="Net inflow amount (CNY)")
    inflow_formatted: str = Field(..., description="Formatted inflow string")
    start_time: str = Field(..., description="Period start time")
    end_time: str = Field(..., description="Period end time")


class StockFlow(BaseModel):
    """Individual stock northbound flow."""
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    net_flow: float = Field(..., description="Net flow amount")
    buy_amount: float = Field(..., description="Buy amount")
    sell_amount: float = Field(..., description="Sell amount")
    holding_change: float = Field(..., description="Holding change percentage")


class NorthboundFlowResponse(BaseModel):
    """Northbound capital flow response."""
    date: str = Field(..., description="Trading date")
    total_inflow: float = Field(..., description="Total net inflow")
    total_inflow_formatted: str = Field(..., description="Formatted total inflow")
    shanghai_inflow: float = Field(..., description="Shanghai Connect inflow")
    shenzhen_inflow: float = Field(..., description="Shenzhen Connect inflow")
    periods: List[PeriodFlow] = Field(..., description="Flow by trading period")
    top_buys: List[StockFlow] = Field(..., description="Top bought stocks")
    top_sells: List[StockFlow] = Field(..., description="Top sold stocks")
    cumulative_inflow_5d: float = Field(..., description="5-day cumulative inflow")
    cumulative_inflow_20d: float = Field(..., description="20-day cumulative inflow")
    timestamp: str = Field(..., description="Data timestamp")


class NorthboundHistoryItem(BaseModel):
    """Historical northbound flow data point."""
    date: str = Field(..., description="Trading date")
    inflow: float = Field(..., description="Net inflow")
    inflow_formatted: str = Field(..., description="Formatted inflow")
    shanghai_inflow: float = Field(..., description="Shanghai Connect inflow")
    shenzhen_inflow: float = Field(..., description="Shenzhen Connect inflow")


class NorthboundHistoryResponse(BaseModel):
    """Northbound historical flow response."""
    data: List[NorthboundHistoryItem] = Field(..., description="Historical data")
    total_days: int = Field(..., description="Total days")


# ============================================================================
# Helper Functions
# ============================================================================

def format_amount(amount: float) -> str:
    """Format amount to human readable string with CNY symbol."""
    if amount >= 100000000:  # 1亿
        return f"+¥{amount/100000000:.1f}亿" if amount >= 0 else f"-¥{abs(amount)/100000000:.1f}亿"
    elif amount >= 10000:  # 1万
        return f"+¥{amount/10000:.1f}万" if amount >= 0 else f"-¥{abs(amount)/10000:.1f}万"
    return f"+¥{amount:.0f}" if amount >= 0 else f"-¥{abs(amount):.0f}"


def format_simple_amount(amount: float) -> str:
    """Format amount with B/M suffix for billions/millions."""
    if abs(amount) >= 1000000000:  # 10亿
        return f"¥{amount/1000000000:.1f}B"
    elif abs(amount) >= 1000000:  # 100万
        return f"¥{amount/1000000:.1f}M"
    return f"¥{amount/1000:.0f}K"


# ============================================================================
# Mock Data
# ============================================================================

MOCK_TOP_BUYS = [
    {"symbol": "600519", "name": "贵州茅台", "net_flow": 523000000, "buy_amount": 892000000, "sell_amount": 369000000, "holding_change": 0.12},
    {"symbol": "000858", "name": "五粮液", "net_flow": 312000000, "buy_amount": 456000000, "sell_amount": 144000000, "holding_change": 0.18},
    {"symbol": "300750", "name": "宁德时代", "net_flow": 278000000, "buy_amount": 412000000, "sell_amount": 134000000, "holding_change": 0.08},
    {"symbol": "000333", "name": "美的集团", "net_flow": 198000000, "buy_amount": 298000000, "sell_amount": 100000000, "holding_change": 0.15},
    {"symbol": "600036", "name": "招商银行", "net_flow": 156000000, "buy_amount": 234000000, "sell_amount": 78000000, "holding_change": 0.06},
]

MOCK_TOP_SELLS = [
    {"symbol": "002594", "name": "比亚迪", "net_flow": -234000000, "buy_amount": 123000000, "sell_amount": 357000000, "holding_change": -0.14},
    {"symbol": "300750", "name": "迈瑞医疗", "net_flow": -187000000, "buy_amount": 98000000, "sell_amount": 285000000, "holding_change": -0.22},
    {"symbol": "600276", "name": "恒瑞医药", "net_flow": -156000000, "buy_amount": 87000000, "sell_amount": 243000000, "holding_change": -0.18},
    {"symbol": "000002", "name": "万科A", "net_flow": -134000000, "buy_amount": 67000000, "sell_amount": 201000000, "holding_change": -0.25},
    {"symbol": "601318", "name": "中国平安", "net_flow": -98000000, "buy_amount": 45000000, "sell_amount": 143000000, "holding_change": -0.09},
]


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/northbound-flow", response_model=ApiResponse[NorthboundFlowResponse])
async def get_northbound_flow(
    trade_date: Optional[str] = Query(None, description="Trade date (YYYY-MM-DD), defaults to today")
):
    """Get northbound capital flow for a specific trading day.
    
    Issue #203: Returns Shanghai/Shenzhen Stock Connect flow data
    including period breakdowns and top buy/sell stocks.
    
    Args:
        trade_date: Trading date in YYYY-MM-DD format. Defaults to today.
        
    Returns:
        NorthboundFlowResponse with detailed flow breakdown.
    """
    try:
        # Use provided date or today
        target_date = trade_date or date.today().isoformat()
        
        # Generate realistic mock data
        # Total inflow: typically between -5B to +10B
        base_inflow = 2400000000  # +2.4B
        variation = (hash(target_date) % 8000000000) - 4000000000  # -4B to +4B variation
        total_inflow = base_inflow + variation
        
        # Split between Shanghai and Shenzhen (typically 60/40)
        shanghai_inflow = total_inflow * 0.6
        shenzhen_inflow = total_inflow * 0.4
        
        # Period breakdown (9:30-11:30, 13:00-15:00)
        periods = [
            PeriodFlow(
                name="OPEN",
                inflow=total_inflow * 0.35,
                inflow_formatted=format_amount(total_inflow * 0.35),
                start_time="09:30",
                end_time="10:30"
            ),
            PeriodFlow(
                name="MID-DAY",
                inflow=total_inflow * 0.45,
                inflow_formatted=format_amount(total_inflow * 0.45),
                start_time="10:30",
                end_time="14:00"
            ),
            PeriodFlow(
                name="CLOSE",
                inflow=total_inflow * 0.20,
                inflow_formatted=format_amount(total_inflow * 0.20),
                start_time="14:00",
                end_time="15:00"
            ),
        ]
        
        # Historical cumulative (mock)
        cumulative_5d = total_inflow * 5 + (hash(target_date) % 10000000000)
        cumulative_20d = total_inflow * 20 + (hash(target_date) % 50000000000)
        
        result = NorthboundFlowResponse(
            date=target_date,
            total_inflow=total_inflow,
            total_inflow_formatted=format_amount(total_inflow),
            shanghai_inflow=shanghai_inflow,
            shenzhen_inflow=shenzhen_inflow,
            periods=periods,
            top_buys=[StockFlow(**stock) for stock in MOCK_TOP_BUYS],
            top_sells=[StockFlow(**stock) for stock in MOCK_TOP_SELLS],
            cumulative_inflow_5d=cumulative_5d,
            cumulative_inflow_20d=cumulative_20d,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get northbound flow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/northbound-flow/history", response_model=ApiResponse[NorthboundHistoryResponse])
async def get_northbound_history(
    days: int = Query(30, ge=1, le=90, description="Number of days to query")
):
    """Get historical northbound capital flow.
    
    Returns daily net inflow for the specified period.
    
    Args:
        days: Number of trading days to return (1-90)
        
    Returns:
        NorthboundHistoryResponse with historical data points.
    """
    try:
        from datetime import timedelta
        
        history = []
        today = date.today()
        
        for i in range(days):
            # Skip weekends (simplified, doesn't account for holidays)
            check_date = today - timedelta(days=i)
            if check_date.weekday() >= 5:  # Saturday or Sunday
                continue
                
            # Generate pseudo-random but consistent flow
            date_seed = int(check_date.strftime("%Y%m%d"))
            base_flow = 1000000000  # 1B
            variation = ((date_seed * 9301 + 49297) % 233280) / 233280 * 6000000000 - 3000000000
            daily_flow = base_flow + variation
            
            history.append(NorthboundHistoryItem(
                date=check_date.isoformat(),
                inflow=daily_flow,
                inflow_formatted=format_simple_amount(daily_flow),
                shanghai_inflow=daily_flow * 0.6,
                shenzhen_inflow=daily_flow * 0.4
            ))
        
        # Reverse to chronological order
        history.reverse()
        
        return ApiResponse(
            code=200,
            message="success",
            data=NorthboundHistoryResponse(
                data=history,
                total_days=len(history)
            )
        )
        
    except Exception as e:
        logger.error(f"Failed to get northbound history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/northbound-flow/stats")
async def get_northbound_stats():
    """Get northbound flow statistics summary."""
    try:
        # Mock statistics
        stats = {
            "ytd_inflow": 52300000000,  # +523亿
            "ytd_inflow_formatted": "+¥523亿",
            "monthly_avg": 2340000000,   // +23.4亿
            "monthly_avg_formatted": "+¥23.4亿",
            "top_sectors": [
                {"name": "食品饮料", "inflow": 8910000000},
                {"name": "医药生物", "inflow": 5670000000},
                {"name": "电子", "inflow": 4320000000},
                {"name": "银行", "inflow": 3120000000},
                {"name": "新能源", "inflow": 2890000000},
            ],
            "holding_top": [
                {"symbol": "600519", "name": "贵州茅台", "value": 156700000000},
                {"symbol": "000858", "name": "五粮液", "value": 89200000000},
                {"symbol": "300750", "name": "宁德时代", "value": 72300000000},
            ],
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        return ApiResponse(code=200, message="success", data=stats)
        
    except Exception as e:
        logger.error(f"Failed to get northbound stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
