"""Portfolio API routes.

Issue #208: Portfolio 历史盈亏趋势 API
Issue #209: Portfolio 行业配置分布 API
"""

import logging
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone
from enum import Enum

from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])


# ============================================================================
# Issue #208: PnL History Models
# ============================================================================

class PeriodType(str, Enum):
    """Time period for PnL history."""
    ONE_DAY = "1d"
    ONE_WEEK = "1w"
    ONE_MONTH = "1m"
    THREE_MONTH = "3m"
    ONE_YEAR = "1y"
    YTD = "ytd"


class PnLDataPoint(BaseModel):
    """Single PnL data point."""
    date: str = Field(..., description="Date string")
    timestamp: int = Field(..., description="Unix timestamp")
    pnl: float = Field(..., description="Profit/Loss amount")
    pnl_formatted: str = Field(..., description="Formatted PnL")
    pnl_percent: float = Field(..., description="PnL percentage")
    total_cost: float = Field(..., description="Total cost basis")
    total_market_value: float = Field(..., description="Total market value")
    cumulative_pnl: float = Field(..., description="Cumulative PnL")


class PnLSummary(BaseModel):
    """PnL summary statistics."""
    total_pnl: float = Field(..., description="Total profit/loss")
    total_pnl_formatted: str = Field(..., description="Formatted total PnL")
    total_pnl_percent: float = Field(..., description="Total PnL percentage")
    best_day: Optional[PnLDataPoint] = Field(None, description="Best performing day")
    worst_day: Optional[PnLDataPoint] = Field(None, description="Worst performing day")
    volatility: float = Field(..., description="PnL volatility (std dev)")
    sharpe_ratio: float = Field(..., description="Risk-adjusted return")


class PnLHistoryResponse(BaseModel):
    """PnL history response."""
    period: str = Field(..., description="Query period")
    start_date: str = Field(..., description="Start date")
    end_date: str = Field(..., description="End date")
    data: List[PnLDataPoint] = Field(..., description="PnL data points")
    summary: PnLSummary = Field(..., description="Summary statistics")
    benchmark_comparison: dict = Field(default={}, description="Benchmark comparison")


# ============================================================================
# Issue #209: Sector Allocation Models
# ============================================================================

class SectorAllocationItem(BaseModel):
    """Individual sector allocation."""
    name: str = Field(..., description="Sector name")
    code: str = Field(..., description="Sector code")
    value: float = Field(..., description="Market value")
    value_formatted: str = Field(..., description="Formatted value")
    percent: float = Field(..., description="Allocation percentage")
    color: str = Field(..., description="Display color")
    stock_count: int = Field(..., description="Number of stocks in sector")
    stocks: List[dict] = Field(default=[], description="Top stocks in sector")


class SectorAllocationResponse(BaseModel):
    """Sector allocation response."""
    total_value: float = Field(..., description="Total portfolio value")
    total_value_formatted: str = Field(..., description="Formatted total value")
    cash_value: float = Field(..., description="Cash position")
    cash_percent: float = Field(..., description="Cash percentage")
    sectors: List[SectorAllocationItem] = Field(..., description="Sector allocations")
    diversification_score: float = Field(..., description="Diversification score (0-100)")
    top_heavy_risk: str = Field(..., description="Concentration risk level")


class IndustryMapping:
    """Industry name mapping and colors."""
    
    SECTOR_COLORS = {
        "食品饮料": "#00F2FF",
        "医药生物": "#DE0541",
        "电子": "#FFB3B5",
        "电力设备": "#FFD81D",
        "银行": "#00DBE7",
        "非银金融": "#7D7D7D",
        "计算机": "#9CA3AF",
        "汽车": "#F59E0B",
        "机械设备": "#10B981",
        "化工": "#8B5CF6",
        "家用电器": "#EC4899",
        "有色金属": "#F97316",
        "建筑材料": "#64748B",
        "房地产": "#94A3B8",
        "交通运输": "#06B6D4",
        "通信": "#3B82F6",
        "传媒": "#A855F7",
        "国防军工": "#DC2626",
        "公用事业": "#059669",
        "煤炭": "#374151",
        "石油石化": "#1F2937",
        "钢铁": "#4B5563",
        "农林牧渔": "#16A34A",
        "商贸零售": "#D946EF",
        "社会服务": "#8B5CF6",
        "美容护理": "#F43F5E",
        "轻工制造": "#84CC16",
        "纺织服饰": "#14B8A6",
        "环保": "#22C55E",
        "综合": "#6B7280",
    }
    
    DEFAULT_COLOR = "#1D2026"
    
    @classmethod
    def get_color(cls, sector_name: str) -> str:
        return cls.SECTOR_COLORS.get(sector_name, cls.DEFAULT_COLOR)


# ============================================================================
# Mock Data Generators
# ============================================================================

def generate_pnl_history(period: str, days: int) -> List[PnLDataPoint]:
    """Generate mock PnL history data."""
    data = []
    end_date = date.today()
    
    # Starting values
    base_cost = 5000000  # 500万成本
    current_value = base_cost
    cumulative_pnl = 0
    
    for i in range(days, -1, -1):
        current_date = end_date - timedelta(days=i)
        if current_date.weekday() >= 5:  # Skip weekends
            continue
            
        # Generate daily PnL with some randomness but trending
        daily_change = (hash(str(current_date)) % 1000000) - 400000  # -40万到+60万
        if i > days // 2:
            daily_change += 50000  # Slight upward trend in first half
        
        current_value += daily_change
        cumulative_pnl += daily_change
        
        pnl_percent = ((current_value - base_cost) / base_cost) * 100
        
        data.append(PnLDataPoint(
            date=current_date.isoformat(),
            timestamp=int(datetime.combine(current_date, datetime.min.time()).timestamp()),
            pnl=daily_change,
            pnl_formatted=f"+{daily_change/10000:.1f}万" if daily_change >= 0 else f"{daily_change/10000:.1f}万",
            pnl_percent=pnl_percent,
            total_cost=base_cost,
            total_market_value=current_value,
            cumulative_pnl=cumulative_pnl
        ))
    
    return data


# ============================================================================
# API Endpoints - Issue #208
# ============================================================================

@router.get("/pnl-history", response_model=ApiResponse[PnLHistoryResponse])
async def get_pnl_history(
    period: PeriodType = Query(PeriodType.ONE_WEEK, description="Time period: 1d, 1w, 1m, 3m, 1y, ytd"),
    user_id: Optional[int] = Query(None, description="User ID (for admin/multi-user)")
):
    """Get portfolio PnL (Profit/Loss) history.
    
    Issue #208: Returns historical profit/loss data for portfolio trend chart.
    Supports multiple time periods: 1D, 1W, 1M, 3M, 1Y, YTD.
    
    Args:
        period: Time period for history data
        user_id: Optional user ID for multi-user systems
        
    Returns:
        PnLHistoryResponse with data points and summary statistics.
    """
    try:
        # Map period to days
        period_days = {
            PeriodType.ONE_DAY: 1,
            PeriodType.ONE_WEEK: 7,
            PeriodType.ONE_MONTH: 30,
            PeriodType.THREE_MONTH: 90,
            PeriodType.ONE_YEAR: 252,  # Trading days
            PeriodType.YTD: (date.today() - date(date.today().year, 1, 1)).days
        }
        
        days = period_days.get(period, 7)
        
        # Generate mock data
        data = generate_pnl_history(period.value, days)
        
        if not data:
            raise HTTPException(status_code=404, detail="No data available for period")
        
        # Calculate summary
        total_pnl = data[-1].cumulative_pnl if data else 0
        total_pnl_percent = data[-1].pnl_percent if data else 0
        
        # Find best and worst days
        sorted_by_pnl = sorted(data, key=lambda x: x.pnl, reverse=True)
        best_day = sorted_by_pnl[0] if sorted_by_pnl else None
        worst_day = sorted_by_pnl[-1] if sorted_by_pnl else None
        
        # Calculate volatility (simplified)
        pnl_values = [d.pnl for d in data]
        mean_pnl = sum(pnl_values) / len(pnl_values) if pnl_values else 0
        variance = sum((x - mean_pnl) ** 2 for x in pnl_values) / len(pnl_values) if pnl_values else 0
        volatility = (variance ** 0.5) / 10000  # Convert to 万
        
        # Mock benchmark comparison
        benchmark_comparison = {
            "portfolio_return": total_pnl_percent,
            "benchmark_return": total_pnl_percent * 0.85,  # Slightly underperform
            "alpha": total_pnl_percent * 0.15,
            "beta": 0.95
        }
        
        summary = PnLSummary(
            total_pnl=total_pnl,
            total_pnl_formatted=f"+{total_pnl/10000:.1f}万" if total_pnl >= 0 else f"{total_pnl/10000:.1f}万",
            total_pnl_percent=total_pnl_percent,
            best_day=best_day,
            worst_day=worst_day,
            volatility=volatility,
            sharpe_ratio=1.2 if total_pnl > 0 else -0.5
        )
        
        result = PnLHistoryResponse(
            period=period.value,
            start_date=data[0].date if data else date.today().isoformat(),
            end_date=data[-1].date if data else date.today().isoformat(),
            data=data,
            summary=summary,
            benchmark_comparison=benchmark_comparison
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get PnL history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pnl-history/daily")
async def get_daily_pnl(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get daily PnL for custom date range."""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else date.today() - timedelta(days=30)
        end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else date.today()
        
        days = (end - start).days
        data = generate_pnl_history("custom", days)
        
        # Filter to date range
        data = [d for d in data if start.isoformat() <= d.date <= end.isoformat()]
        
        return ApiResponse(code=200, message="success", data=data)
        
    except Exception as e:
        logger.error(f"Failed to get daily PnL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# API Endpoints - Issue #209
# ============================================================================

@router.get("/sector-allocation", response_model=ApiResponse[SectorAllocationResponse])
async def get_sector_allocation(
    user_id: Optional[int] = Query(None, description="User ID (for admin/multi-user)"),
    min_percent: float = Query(0.5, ge=0, le=100, description="Minimum percentage to include (others grouped)")
):
    """Get portfolio sector allocation distribution.
    
    Issue #209: Returns sector allocation for portfolio diversification analysis.
    Aggregates holdings by industry/sector with percentage breakdown.
    
    Args:
        user_id: Optional user ID for multi-user systems
        min_percent: Minimum percentage for individual sector display
        
    Returns:
        SectorAllocationResponse with sector breakdown and diversification metrics.
    """
    try:
        # Mock portfolio holdings by sector
        mock_sectors = [
            {"name": "食品饮料", "value": 850000, "stocks": [{"symbol": "600519", "name": "贵州茅台", "value": 500000}, {"symbol": "000858", "name": "五粮液", "value": 350000}]},
            {"name": "医药生物", "value": 620000, "stocks": [{"symbol": "600276", "name": "恒瑞医药", "value": 320000}, {"symbol": "300760", "name": "迈瑞医疗", "value": 300000}]},
            {"name": "电子", "value": 480000, "stocks": [{"symbol": "002594", "name": "比亚迪", "value": 280000}, {"symbol": "300750", "name": "宁德时代", "value": 200000}]},
            {"name": "银行", "value": 320000, "stocks": [{"symbol": "600036", "name": "招商银行", "value": 200000}, {"symbol": "601398", "name": "工商银行", "value": 120000}]},
            {"name": "电力设备", "value": 210000, "stocks": [{"symbol": "601012", "name": "隆基绿能", "value": 150000}, {"symbol": "300274", "name": "阳光电源", "value": 60000}]},
            {"name": "汽车", "value": 180000, "stocks": [{"symbol": "000625", "name": "长安汽车", "value": 100000}, {"symbol": "601633", "name": "长城汽车", "value": 80000}]},
            {"name": "计算机", "value": 120000, "stocks": [{"symbol": "000938", "name": "紫光股份", "value": 70000}, {"symbol": "600570", "name": "恒生电子", "value": 50000}]},
            {"name": "家用电器", "value": 85000, "stocks": [{"symbol": "000333", "name": "美的集团", "value": 85000}]},
            {"name": "化工", "value": 65000, "stocks": [{"symbol": "600309", "name": "万华化学", "value": 65000}]},
            {"name": "有色金属", "value": 45000, "stocks": [{"symbol": "601899", "name": "紫金矿业", "value": 45000}]},
        ]
        
        # Calculate total
        total_value = sum(s["value"] for s in mock_sectors)
        cash_value = 500000  # 50万现金
        total_with_cash = total_value + cash_value
        
        # Build sector allocations
        sectors = []
        others_value = 0
        others_stocks = []
        
        for sector_data in mock_sectors:
            percent = (sector_data["value"] / total_with_cash) * 100
            
            if percent >= min_percent:
                sectors.append(SectorAllocationItem(
                    name=sector_data["name"],
                    code=sector_data["name"][:2].upper(),
                    value=sector_data["value"],
                    value_formatted=f"{sector_data['value']/10000:.1f}万",
                    percent=round(percent, 1),
                    color=IndustryMapping.get_color(sector_data["name"]),
                    stock_count=len(sector_data["stocks"]),
                    stocks=sector_data["stocks"]
                ))
            else:
                others_value += sector_data["value"]
                others_stocks.extend(sector_data["stocks"])
        
        # Add "Others" category if needed
        if others_value > 0:
            others_percent = (others_value / total_with_cash) * 100
            sectors.append(SectorAllocationItem(
                name="其他",
                code="OTHERS",
                value=others_value,
                value_formatted=f"{others_value/10000:.1f}万",
                percent=round(others_percent, 1),
                color=IndustryMapping.DEFAULT_COLOR,
                stock_count=len(others_stocks),
                stocks=others_stocks[:3]  # Show top 3
            ))
        
        # Add cash position
        cash_percent = (cash_value / total_with_cash) * 100
        sectors.append(SectorAllocationItem(
            name="现金",
            code="CASH",
            value=cash_value,
            value_formatted=f"{cash_value/10000:.1f}万",
            percent=round(cash_percent, 1),
            color="#64748B",
            stock_count=0,
            stocks=[]
        ))
        
        # Sort by value descending
        sectors.sort(key=lambda x: x.value, reverse=True)
        
        # Calculate diversification metrics
        # Herfindahl-Hirschman Index (HHI) based on sector concentration
        hhi = sum((s.percent / 100) ** 2 for s in sectors)
        diversification_score = (1 - hhi) * 100  # 0-100 score
        
        # Determine concentration risk
        max_sector_percent = max(s.percent for s in sectors)
        if max_sector_percent > 40:
            risk_level = "high"
        elif max_sector_percent > 25:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        result = SectorAllocationResponse(
            total_value=total_with_cash,
            total_value_formatted=f"{total_with_cash/10000:.1f}万",
            cash_value=cash_value,
            cash_percent=round(cash_percent, 1),
            sectors=sectors,
            diversification_score=round(diversification_score, 1),
            top_heavy_risk=risk_level
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get sector allocation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sector-allocation/trend")
async def get_sector_allocation_trend(
    months: int = Query(6, ge=1, le=24, description="Number of months to analyze")
):
    """Get sector allocation trend over time."""
    try:
        trends = []
        today = date.today()
        
        for i in range(months):
            month_date = today - timedelta(days=i*30)
            trends.append({
                "month": month_date.strftime("%Y-%m"),
                "top_sector": "食品饮料" if i % 3 == 0 else "医药生物" if i % 3 == 1 else "电子",
                "top_sector_percent": 25 + (i % 5),
            })
        
        return ApiResponse(code=200, message="success", data=trends)
        
    except Exception as e:
        logger.error(f"Failed to get sector trend: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/holdings")
async def get_portfolio_holdings(
    sort_by: str = Query("value", description="Sort by: value, pnl, weight"),
    limit: int = Query(50, ge=1, le=100, description="Number of holdings to return")
):
    """Get detailed portfolio holdings."""
    try:
        # Mock holdings data
        holdings = [
            {"symbol": "600519", "name": "贵州茅台", "sector": "食品饮料", "shares": 200, "cost": 150000, "value": 356000, "pnl": 206000, "pnl_percent": 137.3, "weight": 12.5},
            {"symbol": "000858", "name": "五粮液", "sector": "食品饮料", "shares": 1500, "cost": 280000, "value": 390000, "pnl": 110000, "pnl_percent": 39.3, "weight": 13.7},
            {"symbol": "300750", "name": "宁德时代", "sector": "电力设备", "shares": 800, "cost": 160000, "value": 156800, "pnl": -3200, "pnl_percent": -2.0, "weight": 5.5},
            {"symbol": "600036", "name": "招商银行", "sector": "银行", "shares": 5000, "cost": 180000, "value": 200000, "pnl": 20000, "pnl_percent": 11.1, "weight": 7.0},
            {"symbol": "002594", "name": "比亚迪", "sector": "汽车", "shares": 600, "cost": 156000, "value": 168000, "pnl": 12000, "pnl_percent": 7.7, "weight": 5.9},
        ]
        
        # Sort
        if sort_by == "pnl":
            holdings.sort(key=lambda x: x["pnl"], reverse=True)
        elif sort_by == "weight":
            holdings.sort(key=lambda x: x["weight"], reverse=True)
        
        return ApiResponse(code=200, message="success", data=holdings[:limit])
        
    except Exception as e:
        logger.error(f"Failed to get holdings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
