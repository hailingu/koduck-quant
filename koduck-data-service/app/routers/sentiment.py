"""Sentiment Radar API routes.

Issue #198: Sentiment Radar API - 情绪雷达数据接口
Provides market sentiment analysis across 5 dimensions.
"""

import logging
import random
from typing import Dict, List
from datetime import datetime, timezone

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/market", tags=["sentiment"])


# ============================================================================
# Models
# ============================================================================

class SentimentDimension(BaseModel):
    """Individual sentiment dimension data."""
    value: int = Field(..., ge=0, le=100, description="Dimension value 0-100")
    label: str = Field(..., description="Dimension label")
    trend: str = Field(..., description="Trend direction: rising/falling/stable")
    change: float = Field(..., description="Change from previous period")


class SentimentRadarResponse(BaseModel):
    """Sentiment radar response with 5 dimensions."""
    activity: SentimentDimension = Field(..., description="Market activity (涨跌停家数占比)")
    volatility: SentimentDimension = Field(..., description="Market volatility (ATR/VIX)")
    trend: SentimentDimension = Field(..., description="Trend strength (均线多头排列)")
    fear: SentimentDimension = Field(..., description="Fear index (涨跌家数比)")
    flow: SentimentDimension = Field(..., description="Capital flow (主力资金流向)")
    overall: int = Field(..., ge=0, le=100, description="Overall sentiment score")
    overall_label: str = Field(..., description="Overall sentiment label")
    timestamp: str = Field(..., description="Data timestamp")


class SentimentHistoryItem(BaseModel):
    """Historical sentiment data point."""
    timestamp: str = Field(..., description="ISO timestamp")
    activity: int = Field(..., description="Activity value")
    volatility: int = Field(..., description="Volatility value")
    trend: int = Field(..., description="Trend value")
    fear: int = Field(..., description="Fear value")
    flow: int = Field(..., description="Flow value")
    overall: int = Field(..., description="Overall score")


class SentimentStats(BaseModel):
    """Sentiment statistics."""
    avg_activity_7d: float = Field(..., description="7-day average activity")
    avg_volatility_7d: float = Field(..., description="7-day average volatility")
    sentiment_distribution: Dict[str, int] = Field(..., description="Distribution of sentiment levels")
    correlation_with_market: float = Field(..., description="Correlation with market returns")


# ============================================================================
# Helper Functions
# ============================================================================

def calculate_dimension(value: int, thresholds: Dict) -> Dict:
    """Calculate dimension label and trend based on value."""
    if value >= 70:
        label = thresholds.get("high", "High")
    elif value >= 40:
        label = thresholds.get("medium", "Medium")
    else:
        label = thresholds.get("low", "Low")
    
    # Random trend for mock data
    change = random.uniform(-10, 10)
    if change > 3:
        trend = "rising"
    elif change < -3:
        trend = "falling"
    else:
        trend = "stable"
    
    return {"label": label, "trend": trend, "change": round(change, 1)}


def calculate_overall_sentiment(dimensions: Dict[str, int]) -> tuple:
    """Calculate overall sentiment score and label."""
    # Weighted average: activity 20%, volatility 15%, trend 25%, fear 20%, flow 20%
    weights = {"activity": 0.20, "volatility": 0.15, "trend": 0.25, "fear": 0.20, "flow": 0.20}
    
    # Invert fear (lower fear = higher sentiment)
    adjusted_fear = 100 - dimensions["fear"]
    
    overall = int(
        dimensions["activity"] * weights["activity"] +
        dimensions["volatility"] * weights["volatility"] +
        dimensions["trend"] * weights["trend"] +
        adjusted_fear * weights["fear"] +
        dimensions["flow"] * weights["flow"]
    )
    
    if overall >= 70:
        label = "积极乐观"
    elif overall >= 50:
        label = "中性偏乐观"
    elif overall >= 30:
        label = "中性偏谨慎"
    else:
        label = "悲观谨慎"
    
    return overall, label


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/sentiment", response_model=ApiResponse[SentimentRadarResponse])
async def get_sentiment_radar():
    """Get market sentiment radar data across 5 dimensions.
    
    Issue #198: Returns sentiment analysis including:
    - Activity: Market activity based on limit up/down stocks ratio
    - Volatility: Market volatility using ATR/VIX indicators
    - Trend: Trend strength from moving average alignment
    - Fear: Fear index from advance/decline ratio
    - Flow: Capital flow from main force money direction
    
    All values are normalized to 0-100 scale.
    """
    try:
        # Generate realistic mock data
        # In production, these would be calculated from real market data
        
        # Activity: based on涨停跌停家数占比 (higher = more active)
        activity_value = random.randint(45, 85)
        activity_info = calculate_dimension(activity_value, {
            "high": "极度活跃", "medium": "正常活跃", "low": "相对冷清"
        })
        
        # Volatility: based on ATR/VIX (higher = more volatile = more nervous)
        volatility_value = random.randint(30, 75)
        volatility_info = calculate_dimension(volatility_value, {
            "high": "波动剧烈", "medium": "波动正常", "low": "波动平稳"
        })
        
        # Trend: based on均线多头排列比例 (higher = stronger uptrend)
        trend_value = random.randint(35, 80)
        trend_info = calculate_dimension(trend_value, {
            "high": "强势上涨", "medium": "趋势震荡", "low": "趋势偏弱"
        })
        
        # Fear: based on涨跌家数比 (higher = more fear)
        fear_value = random.randint(20, 70)
        fear_info = calculate_dimension(fear_value, {
            "high": "恐慌情绪", "medium": "谨慎情绪", "low": "情绪稳定"
        })
        
        # Flow: based on主力资金净流入 (higher = more inflow)
        flow_value = random.randint(40, 90)
        flow_info = calculate_dimension(flow_value, {
            "high": "资金大幅流入", "medium": "资金小幅流入", "low": "资金流出"
        })
        
        dimensions = {
            "activity": activity_value,
            "volatility": volatility_value,
            "trend": trend_value,
            "fear": fear_value,
            "flow": flow_value
        }
        
        overall, overall_label = calculate_overall_sentiment(dimensions)
        
        result = SentimentRadarResponse(
            activity=SentimentDimension(
                value=activity_value,
                label=activity_info["label"],
                trend=activity_info["trend"],
                change=activity_info["change"]
            ),
            volatility=SentimentDimension(
                value=volatility_value,
                label=volatility_info["label"],
                trend=volatility_info["trend"],
                change=volatility_info["change"]
            ),
            trend=SentimentDimension(
                value=trend_value,
                label=trend_info["label"],
                trend=trend_info["trend"],
                change=trend_info["change"]
            ),
            fear=SentimentDimension(
                value=fear_value,
                label=fear_info["label"],
                trend=fear_info["trend"],
                change=fear_info["change"]
            ),
            flow=SentimentDimension(
                value=flow_value,
                label=flow_info["label"],
                trend=flow_info["trend"],
                change=flow_info["change"]
            ),
            overall=overall,
            overall_label=overall_label,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get sentiment radar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/history", response_model=ApiResponse[List[SentimentHistoryItem]])
async def get_sentiment_history(
    days: int = Query(7, ge=1, le=30, description="Number of days to query")
):
    """Get historical sentiment data.
    
    Returns daily sentiment values for trend analysis.
    
    Args:
        days: Number of days to return (1-30)
        
    Returns:
        List of historical sentiment data points.
    """
    try:
        from datetime import timedelta
        
        history = []
        today = datetime.now(timezone.utc)
        
        for i in range(days):
            check_date = today - timedelta(days=i)
            
            # Generate pseudo-random but consistent values
            date_seed = int(check_date.strftime("%Y%m%d"))
            random.seed(date_seed)
            
            history.append(SentimentHistoryItem(
                timestamp=check_date.isoformat(),
                activity=random.randint(40, 85),
                volatility=random.randint(30, 75),
                trend=random.randint(35, 80),
                fear=random.randint(20, 70),
                flow=random.randint(40, 90),
                overall=random.randint(35, 75)
            ))
        
        random.seed()  # Reset random seed
        history.reverse()  # Chronological order
        
        return ApiResponse(code=200, message="success", data=history)
        
    except Exception as e:
        logger.error(f"Failed to get sentiment history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/stats")
async def get_sentiment_stats(
    days: int = Query(7, ge=1, le=30, description="Statistics period")
):
    """Get sentiment statistics summary."""
    try:
        # Mock statistics
        stats = SentimentStats(
            avg_activity_7d=random.uniform(55, 75),
            avg_volatility_7d=random.uniform(45, 65),
            sentiment_distribution={
                "极度乐观": random.randint(5, 15),
                "乐观": random.randint(20, 35),
                "中性": random.randint(30, 45),
                "谨慎": random.randint(10, 25),
                "悲观": random.randint(5, 15)
            },
            correlation_with_market=random.uniform(0.6, 0.85)
        )
        
        return ApiResponse(code=200, message="success", data=stats)
        
    except Exception as e:
        logger.error(f"Failed to get sentiment stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
