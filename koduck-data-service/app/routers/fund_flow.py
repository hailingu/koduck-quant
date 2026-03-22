"""API routes for fund flow analysis.

Provides endpoints for:
- Sector fund game matrix data
- Fund divergence alerts
"""

import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/fund-flow", tags=["fund-flow"])


# Pydantic Models
class SectorFundFlow(BaseModel):
    """Sector fund flow data."""
    sector: str = Field(..., description="Sector name")
    main_force: dict = Field(..., description="Main force capital flow")
    retail: dict = Field(..., description="Retail capital flow")
    northbound: dict = Field(..., description="Northbound capital flow")
    game_index: float = Field(..., description="Game index (0-100)")
    price_change: float = Field(..., description="Price change percentage")
    signal: str = Field(..., description="Signal type")


class DivergenceAlert(BaseModel):
    """Fund divergence alert."""
    id: str = Field(..., description="Alert ID")
    type: str = Field(..., description="Alert type")
    priority: str = Field(..., description="Alert priority")
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    sector: str = Field(..., description="Sector name")
    price_change: float = Field(..., description="Price change percentage")
    main_force_flow: float = Field(..., description="Main force flow amount")
    description: str = Field(..., description="Alert description")
    recommendation: str = Field(..., description="Trading recommendation")
    triggered_at: str = Field(..., description="Trigger time")
    confidence: float = Field(..., description="Confidence score (0-1)")


# Mock data - replace with actual database queries
MOCK_SECTOR_DATA = [
    {
        "sector": "银行",
        "main_force": {"value": 8900000000, "direction": "in"},
        "retail": {"value": 4500000000, "direction": "out"},
        "northbound": {"value": 2300000000, "direction": "in"},
        "game_index": 91,
        "price_change": 2.35,
        "signal": "main_dominant"
    },
    {
        "sector": "新能源",
        "main_force": {"value": 6700000000, "direction": "in"},
        "retail": {"value": 1200000000, "direction": "in"},
        "northbound": {"value": 1500000000, "direction": "in"},
        "game_index": 76,
        "price_change": 3.12,
        "signal": "main_dominant"
    },
    {
        "sector": "汽车",
        "main_force": {"value": 2400000000, "direction": "in"},
        "retail": {"value": 1800000000, "direction": "in"},
        "northbound": {"value": 800000000, "direction": "in"},
        "game_index": 58,
        "price_change": 1.25,
        "signal": "balanced"
    },
    {
        "sector": "医药",
        "main_force": {"value": 1200000000, "direction": "out"},
        "retail": {"value": 3400000000, "direction": "in"},
        "northbound": {"value": 500000000, "direction": "out"},
        "game_index": 32,
        "price_change": -0.85,
        "signal": "retail_dominant"
    },
    {
        "sector": "科技",
        "main_force": {"value": 6700000000, "direction": "out"},
        "retail": {"value": 7800000000, "direction": "in"},
        "northbound": {"value": 1200000000, "direction": "out"},
        "game_index": 18,
        "price_change": 1.89,
        "signal": "danger"
    },
]

MOCK_ALERTS = [
    {
        "id": "1",
        "type": "golden_pit",
        "priority": "high",
        "symbol": "601012",
        "name": "隆基绿能",
        "sector": "新能源",
        "price_change": -3.2,
        "main_force_flow": 1800000000,
        "description": "价格下跌3.2%，但主力资金流入18亿，可能是黄金坑机会",
        "recommendation": "关注低吸机会，建议分批建仓",
        "triggered_at": "14:22:05",
        "confidence": 0.85,
    },
    {
        "id": "2",
        "type": "fake_breakout",
        "priority": "critical",
        "symbol": "000001",
        "name": "平安银行",
        "sector": "银行",
        "price_change": 4.5,
        "main_force_flow": -800000000,
        "description": "价格大涨4.5%，但主力资金净流出8亿，假突破风险",
        "recommendation": "建议减仓，谨防回调",
        "triggered_at": "13:58:12",
        "confidence": 0.92,
    },
]


@router.get("/sector-matrix", response_model=ApiResponse[List[SectorFundFlow]])
async def get_sector_fund_matrix(
    sort_by: Optional[str] = Query("game_index", description="Sort by: game_index, main_force, sector"),
    filter_signal: Optional[str] = Query(None, description="Filter by signal type")
):
    """Get sector fund game matrix data.
    
    Returns fund flow data for all sectors including:
    - Main force capital flow
    - Retail capital flow
    - Northbound capital flow
    - Game index calculation
    - Trading signals
    """
    try:
        data = MOCK_SECTOR_DATA.copy()
        
        # Filter
        if filter_signal:
            data = [d for d in data if d["signal"] == filter_signal]
        
        # Sort
        if sort_by == "game_index":
            data.sort(key=lambda x: x["game_index"], reverse=True)
        elif sort_by == "main_force":
            data.sort(key=lambda x: abs(x["main_force"]["value"]), reverse=True)
        elif sort_by == "sector":
            data.sort(key=lambda x: x["sector"])
        
        return ApiResponse(
            code=200,
            message="success",
            data=data
        )
    except Exception as e:
        logger.error(f"Failed to get sector matrix: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/divergence-alerts", response_model=ApiResponse[List[DivergenceAlert]])
async def get_divergence_alerts(
    priority: Optional[str] = Query(None, description="Filter by priority: critical, high, medium, low"),
    alert_type: Optional[str] = Query(None, description="Filter by type: fake_breakout, golden_pit, accumulation, distribution, retail_trap"),
    limit: int = Query(50, ge=1, le=100, description="Number of alerts to return")
):
    """Get fund divergence alerts.
    
    Returns real-time divergence alerts including:
    - Fake breakout warnings
    - Golden pit opportunities
    - Accumulation signals
    - Distribution warnings
    - Retail trap detections
    """
    try:
        data = MOCK_ALERTS.copy()
        
        # Filter by priority
        if priority:
            data = [d for d in data if d["priority"] == priority]
        
        # Filter by type
        if alert_type:
            data = [d for d in data if d["type"] == alert_type]
        
        # Limit results
        data = data[:limit]
        
        return ApiResponse(
            code=200,
            message="success",
            data=data
        )
    except Exception as e:
        logger.error(f"Failed to get divergence alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sector-matrix/{sector}", response_model=ApiResponse[SectorFundFlow])
async def get_sector_detail(sector: str):
    """Get detailed fund flow data for a specific sector."""
    try:
        for data in MOCK_SECTOR_DATA:
            if data["sector"] == sector:
                return ApiResponse(
                    code=200,
                    message="success",
                    data=data
                )
        raise HTTPException(status_code=404, detail="Sector not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get sector detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/stats")
async def get_alert_stats():
    """Get divergence alert statistics."""
    try:
        stats = {
            "total_alerts": len(MOCK_ALERTS),
            "by_priority": {
                "critical": len([a for a in MOCK_ALERTS if a["priority"] == "critical"]),
                "high": len([a for a in MOCK_ALERTS if a["priority"] == "high"]),
                "medium": len([a for a in MOCK_ALERTS if a["priority"] == "medium"]),
                "low": len([a for a in MOCK_ALERTS if a["priority"] == "low"]),
            },
            "by_type": {
                "fake_breakout": len([a for a in MOCK_ALERTS if a["type"] == "fake_breakout"]),
                "golden_pit": len([a for a in MOCK_ALERTS if a["type"] == "golden_pit"]),
                "accumulation": len([a for a in MOCK_ALERTS if a["type"] == "accumulation"]),
                "distribution": len([a for a in MOCK_ALERTS if a["type"] == "distribution"]),
                "retail_trap": len([a for a in MOCK_ALERTS if a["type"] == "retail_trap"]),
            }
        }
        
        return ApiResponse(
            code=200,
            message="success",
            data=stats
        )
    except Exception as e:
        logger.error(f"Failed to get alert stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert (mark as read)."""
    try:
        # TODO: Update alert status in database
        logger.info(f"Alert {alert_id} acknowledged")
        return ApiResponse(
            code=200,
            message="Alert acknowledged",
            data={"alert_id": alert_id}
        )
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))
