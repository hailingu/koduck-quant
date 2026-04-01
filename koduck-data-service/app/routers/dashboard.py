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

import akshare as ak
import pandas as pd

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
    code: str = Field(default="", description="Sector code")
    inflow: float = Field(default=0, description="Inflow amount")
    outflow: float = Field(default=0, description="Outflow amount")
    net_flow: float = Field(..., description="Net flow (inflow - outflow)")
    change: float = Field(default=0, description="Change percentage")
    market_cap: float = Field(default=0, description="Total market cap")
    leading_stocks: List[str] = Field(default=[], description="Top gaining stocks")


class SectorFlowResponse(BaseModel):
    """Sector flow response model."""
    total_inflow: float = Field(default=0, description="Total market inflow")
    total_outflow: float = Field(default=0, description="Total market outflow")
    net_flow: float = Field(default=0, description="Net market flow")
    industry: List[SectorFlowItem] = Field(default=[], description="Industry sectors")
    concept: List[SectorFlowItem] = Field(default=[], description="Concept sectors")
    region: List[SectorFlowItem] = Field(default=[], description="Region sectors")
    timestamp: str = Field(..., description="ISO timestamp")


def fetch_sector_fund_flow_realtime() -> pd.DataFrame:
    """Fetch real-time sector fund flow from AKShare.
    
    Uses ak.stock_sector_fund_flow_rank() to get current fund flow data.
    """
    try:
        # Get industry fund flow (行业资金流)
        df = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
        return df
    except Exception as e:
        logger.warning(f"Failed to fetch sector fund flow: {e}")
        return pd.DataFrame()


def parse_sector_flow_df(df: pd.DataFrame, sector_type: str, limit: int = 10) -> List[SectorFlowItem]:
    """Parse DataFrame into SectorFlowItem list.
    
    Args:
        df: DataFrame with AKShare sector fund flow data
        sector_type: Type of sector (industry/concept/region)
        limit: Maximum number of sectors to return
    """
    if df.empty:
        return []
    
    result = []
    try:
        # Handle different column naming conventions in AKShare
        # Common columns: 名称, 今日主力净流入-净额, 今日主力净流入-净占比, etc.
        name_col = "名称"
        
        # Try different possible column names for inflow/outflow
        inflow_cols = ["今日主力净流入-净额", "主力净流入-净额", "今日净流入", "主力净流入"]
        net_percent_cols = ["今日主力净流入-净占比", "主力净流入-净占比", "净流入占比", "涨跌幅"]
        
        inflow_col = None
        for col in inflow_cols:
            if col in df.columns:
                inflow_col = col
                break
        
        net_percent_col = None
        for col in net_percent_cols:
            if col in df.columns:
                net_percent_col = col
                break
        
        if not inflow_col or name_col not in df.columns:
            logger.warning(f"Required columns not found in DataFrame. Available: {df.columns.tolist()}")
            return []
        
        # Sort by inflow and take top items
        df_sorted = df.sort_values(by=inflow_col, ascending=False).head(limit * 2)
        
        for _, row in df_sorted.head(limit).iterrows():
            try:
                name = str(row[name_col])
                net_flow = float(row[inflow_col]) if pd.notna(row[inflow_col]) else 0
                
                # Net flow is in 10k yuan (万元), convert to yuan
                net_flow = net_flow * 10000
                
                # Estimate inflow/outflow based on net flow
                if net_flow > 0:
                    inflow = net_flow
                    outflow = 0
                else:
                    inflow = 0
                    outflow = abs(net_flow)
                
                change = 0
                if net_percent_col and net_percent_col in row:
                    change_val = row[net_percent_col]
                    if pd.notna(change_val):
                        # Remove % sign if present and convert to float
                        change_str = str(change_val).replace('%', '')
                        try:
                            change = float(change_str) / 100
                        except ValueError:
                            change = 0
                
                result.append(SectorFlowItem(
                    name=name,
                    code="",
                    inflow=inflow,
                    outflow=outflow,
                    net_flow=net_flow,
                    change=change,
                ))
            except Exception as e:
                logger.debug(f"Error parsing row: {e}")
                continue
                
    except Exception as e:
        logger.warning(f"Error parsing sector flow DataFrame: {e}")
    
    return result


# Fallback mock data
SECTOR_MOCK_DATA_INDUSTRY = [
    {"name": "半导体", "inflow": 15.2, "outflow": 3.2, "change": 0.028},
    {"name": "银行", "inflow": 28.3, "outflow": 5.1, "change": 0.045},
    {"name": "电力", "inflow": 8.2, "outflow": 2.5, "change": 0.022},
    {"name": "医药商业", "inflow": 6.8, "outflow": 4.2, "change": 0.015},
    {"name": "白酒", "inflow": 9.1, "outflow": 6.3, "change": 0.022},
]

SECTOR_MOCK_DATA_CONCEPT = [
    {"name": "人工智能", "inflow": 22.5, "outflow": 4.2, "change": 0.035},
    {"name": "芯片", "inflow": 18.3, "outflow": 3.1, "change": 0.028},
    {"name": "新能源", "inflow": 12.5, "outflow": 5.2, "change": 0.018},
    {"name": "5G", "inflow": 8.8, "outflow": 2.2, "change": 0.015},
    {"name": "元宇宙", "inflow": 5.2, "outflow": 1.8, "change": 0.012},
]

SECTOR_MOCK_DATA_REGION = [
    {"name": "浙江", "inflow": 25.5, "outflow": 8.2, "change": 0.032},
    {"name": "广东", "inflow": 32.3, "outflow": 9.1, "change": 0.042},
    {"name": "上海", "inflow": 18.8, "outflow": 6.5, "change": 0.025},
    {"name": "北京", "inflow": 15.2, "outflow": 4.8, "change": 0.018},
    {"name": "江苏", "inflow": 12.5, "outflow": 3.9, "change": 0.015},
]


def get_mock_sector_data(data_list: List[dict]) -> List[SectorFlowItem]:
    """Convert mock data to SectorFlowItem."""
    result = []
    for item in data_list:
        inflow = item["inflow"] * 100000000  # Convert to yuan
        outflow = item["outflow"] * 100000000
        result.append(SectorFlowItem(
            name=item["name"],
            code="",
            inflow=inflow,
            outflow=outflow,
            net_flow=inflow - outflow,
            change=item["change"],
        ))
    return result


@router.get("/sector-flow", response_model=ApiResponse[SectorFlowResponse])
async def get_sector_flow(
    sort_by: Optional[str] = Query("net_flow", description="Sort by: net_flow, inflow, outflow, change"),
    limit: int = Query(10, ge=1, le=20, description="Number of sectors per type to return")
):
    """Get sector capital flow data for Capital River component.
    
    Returns inflow/outflow data for industry, concept, and region sectors.
    Data is fetched from AKShare in real-time.
    """
    try:
        # Try to fetch real data from AKShare
        industry_data = []
        concept_data = []
        region_data = []
        
        try:
            # Fetch industry fund flow
            df_industry = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
            industry_data = parse_sector_flow_df(df_industry, "industry", limit)
            logger.info(f"Fetched {len(industry_data)} industry sectors from AKShare")
        except Exception as e:
            logger.warning(f"Failed to fetch industry data: {e}")
        
        try:
            # Fetch concept fund flow
            df_concept = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="概念资金流")
            concept_data = parse_sector_flow_df(df_concept, "concept", limit)
            logger.info(f"Fetched {len(concept_data)} concept sectors from AKShare")
        except Exception as e:
            logger.warning(f"Failed to fetch concept data: {e}")
        
        try:
            # Fetch region fund flow
            df_region = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="地域资金流")
            region_data = parse_sector_flow_df(df_region, "region", limit)
            logger.info(f"Fetched {len(region_data)} region sectors from AKShare")
        except Exception as e:
            logger.warning(f"Failed to fetch region data: {e}")
        
        # Use mock data if real data is empty
        if not industry_data:
            industry_data = get_mock_sector_data(SECTOR_MOCK_DATA_INDUSTRY)
        if not concept_data:
            concept_data = get_mock_sector_data(SECTOR_MOCK_DATA_CONCEPT)
        if not region_data:
            region_data = get_mock_sector_data(SECTOR_MOCK_DATA_REGION)
        
        # Sort by specified field
        def sort_sectors(sectors: List[SectorFlowItem]) -> List[SectorFlowItem]:
            if sort_by == "net_flow":
                return sorted(sectors, key=lambda x: abs(x.net_flow), reverse=True)
            elif sort_by == "inflow":
                return sorted(sectors, key=lambda x: x.inflow, reverse=True)
            elif sort_by == "outflow":
                return sorted(sectors, key=lambda x: x.outflow, reverse=True)
            elif sort_by == "change":
                return sorted(sectors, key=lambda x: x.change, reverse=True)
            return sectors
        
        industry_data = sort_sectors(industry_data)[:limit]
        concept_data = sort_sectors(concept_data)[:limit]
        region_data = sort_sectors(region_data)[:limit]
        
        # Calculate totals
        total_inflow = sum(s.inflow for s in industry_data + concept_data + region_data)
        total_outflow = sum(s.outflow for s in industry_data + concept_data + region_data)
        
        result = SectorFlowResponse(
            total_inflow=total_inflow,
            total_outflow=total_outflow,
            net_flow=total_inflow - total_outflow,
            industry=industry_data,
            concept=concept_data,
            region=region_data,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get sector flow: {e}")
        # Return fallback data even on error
        industry_data = get_mock_sector_data(SECTOR_MOCK_DATA_INDUSTRY)[:limit]
        concept_data = get_mock_sector_data(SECTOR_MOCK_DATA_CONCEPT)[:limit]
        region_data = get_mock_sector_data(SECTOR_MOCK_DATA_REGION)[:limit]
        
        total_inflow = sum(s.inflow for s in industry_data + concept_data + region_data)
        total_outflow = sum(s.outflow for s in industry_data + concept_data + region_data)
        
        result = SectorFlowResponse(
            total_inflow=total_inflow,
            total_outflow=total_outflow,
            net_flow=total_inflow - total_outflow,
            industry=industry_data,
            concept=concept_data,
            region=region_data,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        return ApiResponse(code=200, message="success (fallback)", data=result)


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
    {"symbol": "000001", "name": "平安银行", "type": "buy", "amount": 2400000, "price": 10.50, "volume": 228571, "type_label": "BLOCK ORDER", "exchange": "SZSE", "urgency": "high"},
    {"symbol": "600519", "name": "贵州茅台", "type": "sell", "amount": 1800000, "price": 1650.30, "volume": 1091, "type_label": "DARK POOL", "exchange": "SSE", "urgency": "medium"},
    {"symbol": "000858", "name": "五 粮 液", "type": "buy", "amount": 3200000, "price": 145.80, "volume": 21947, "type_label": "ICEBERG", "exchange": "SZSE", "urgency": "high"},
    {"symbol": "600036", "name": "招商银行", "type": "buy", "amount": 1500000, "price": 32.20, "volume": 46584, "type_label": "BLOCK ORDER", "exchange": "SSE", "urgency": "medium"},
    {"symbol": "002594", "name": "比亚迪", "type": "sell", "amount": 2100000, "price": 245.80, "volume": 8543, "type_label": "SWEEPER", "exchange": "SZSE", "urgency": "high"},
    {"symbol": "300750", "name": "宁德时代", "type": "buy", "amount": 980000, "price": 182.60, "volume": 5366, "type_label": "DARK POOL", "exchange": "SZSE", "urgency": "low"},
    {"symbol": "600900", "name": "长江电力", "type": "sell", "amount": 1650000, "price": 25.40, "volume": 64960, "type_label": "BLOCK ORDER", "exchange": "SSE", "urgency": "medium"},
    {"symbol": "002371", "name": "北方华创", "type": "buy", "amount": 750000, "price": 328.90, "volume": 2280, "type_label": "ICEBERG", "exchange": "SZSE", "urgency": "high"},
]


def format_amount(amount: float) -> str:
    """Format amount to human readable string."""
    if amount >= 1000000:
        return f"{(amount/1000000):.1f}M"
    elif amount >= 1000:
        return f"{(amount/1000):.1f}K"
    return f"{amount:.0f}"


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
                {"name": "银行", "volume": 450000000},
                {"name": "科技", "volume": 280000000},
                {"name": "消费", "volume": 150000000},
            ]
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get big order stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
