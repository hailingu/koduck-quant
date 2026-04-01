"""API routes for tiered watchlist.

Provides endpoints for:
- Getting tiered watchlist data
- Managing track/watch layer stocks
- WebSocket for real-time track layer updates
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse

from app.models.schemas import ApiResponse
from app.models.tiered_watchlist import (
    TieredWatchlistResponse, TrackStockData, WatchKlineData,
    WatchlistItem, UserTrackingConfig
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/a-watchlist", tags=["tiered-watchlist"])


# Mock services for compilation - will be replaced with actual implementations
class MockTieredScheduler:
    async def get_user_tiered_data(self, user_id: int):
        return {
            "track_layer": [],
            "watch_layer": [],
            "track_count": 0,
            "watch_count": 0,
            "watch_update_status": {"total": 0, "fresh": 0, "stale": 0}
        }
    
    async def add_user_track_stock(self, user_id: int, symbol: str):
        return True
    
    async def add_user_watch_stock(self, user_id: int, symbol: str):
        return True
    
    def get_stats(self):
        return {}


class MockTieredRedis:
    async def get_user_track_stocks(self, user_id: int):
        return []
    
    async def get_user_watch_stocks(self, user_id: int):
        return []
    
    async def remove_user_track_stock(self, user_id: int, symbol: str):
        return True
    
    async def remove_user_watch_stock(self, user_id: int, symbol: str):
        return True


# Global instances (to be initialized in main.py)
scheduler = MockTieredScheduler()
redis_store = MockTieredRedis()


def set_scheduler(sch):
    """Set scheduler instance."""
    global scheduler
    scheduler = sch


def set_redis_store(store):
    """Set redis store instance."""
    global redis_store
    redis_store = store


@router.get("/tiered", response_model=ApiResponse[TieredWatchlistResponse])
async def get_tiered_watchlist(
    user_id: int = Query(..., description="User ID"),
    include_freshness: bool = Query(True, description="Include data freshness status")
) -> ApiResponse[TieredWatchlistResponse]:
    """Get tiered watchlist data for user.
    
    Returns track layer (real-time) and watch layer (1-min kline) data.
    
    Args:
        user_id: User ID
        include_freshness: Whether to include data freshness status
        
    Returns:
        Tiered watchlist response
    """
    try:
        data = await scheduler.get_user_tiered_data(user_id)
        
        response = TieredWatchlistResponse(
            track_layer=data.get("track_layer", []),
            watch_layer=data.get("watch_layer", []),
            track_count=data.get("track_count", 0),
            watch_count=data.get("watch_count", 0),
            watch_update_status=data.get("watch_update_status", {})
        )
        
        return ApiResponse(
            code=200,
            message="success",
            data=response
        )
        
    except Exception as e:
        logger.error(f"Failed to get tiered watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/track/add")
async def add_track_stock(
    user_id: int = Query(..., description="User ID"),
    symbol: str = Query(..., description="Stock symbol")
) -> ApiResponse[dict]:
    """Add stock to user's track layer.
    
    Track layer supports up to 100 stocks with real-time updates.
    
    Args:
        user_id: User ID
        symbol: Stock symbol to add
        
    Returns:
        Success response with track count
    """
    try:
        success = await scheduler.add_user_track_stock(user_id, symbol)
        
        if not success:
            return ApiResponse(
                code=400,
                message="Track layer full or stock already exists",
                data={"success": False}
            )
        
        track_count = len(await redis_store.get_user_track_stocks(user_id))
        
        return ApiResponse(
            code=200,
            message="Stock added to track layer",
            data={
                "success": True,
                "symbol": symbol,
                "track_count": track_count
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to add track stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watch/add")
async def add_watch_stock(
    user_id: int = Query(..., description="User ID"),
    symbol: str = Query(..., description="Stock symbol")
) -> ApiResponse[dict]:
    """Add stock to user's watch layer.
    
    Watch layer supports up to 1500 stocks with 1-minute kline updates.
    
    Args:
        user_id: User ID
        symbol: Stock symbol to add
        
    Returns:
        Success response with watch count
    """
    try:
        success = await scheduler.add_user_watch_stock(user_id, symbol)
        
        if not success:
            return ApiResponse(
                code=400,
                message="Watch layer full or stock already exists",
                data={"success": False}
            )
        
        watch_count = len(await redis_store.get_user_watch_stocks(user_id))
        
        return ApiResponse(
            code=200,
            message="Stock added to watch layer",
            data={
                "success": True,
                "symbol": symbol,
                "watch_count": watch_count
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to add watch stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/track/remove")
async def remove_track_stock(
    user_id: int = Query(..., description="User ID"),
    symbol: str = Query(..., description="Stock symbol")
) -> ApiResponse[dict]:
    """Remove stock from user's track layer.
    
    Args:
        user_id: User ID
        symbol: Stock symbol to remove
        
    Returns:
        Success response
    """
    try:
        success = await redis_store.remove_user_track_stock(user_id, symbol)
        
        return ApiResponse(
            code=200,
            message="Stock removed from track layer",
            data={"success": success}
        )
        
    except Exception as e:
        logger.error(f"Failed to remove track stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/watch/remove")
async def remove_watch_stock(
    user_id: int = Query(..., description="User ID"),
    symbol: str = Query(..., description="Stock symbol")
) -> ApiResponse[dict]:
    """Remove stock from user's watch layer.
    
    Args:
        user_id: User ID
        symbol: Stock symbol to remove
        
    Returns:
        Success response
    """
    try:
        success = await redis_store.remove_user_watch_stock(user_id, symbol)
        
        return ApiResponse(
            code=200,
            message="Stock removed from watch layer",
            data={"success": success}
        )
        
    except Exception as e:
        logger.error(f"Failed to remove watch stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/track/list")
async def get_track_list(
    user_id: int = Query(..., description="User ID")
) -> ApiResponse[List[str]]:
    """Get user's track layer stock list.
    
    Args:
        user_id: User ID
        
    Returns:
        List of stock symbols in track layer
    """
    try:
        symbols = await redis_store.get_user_track_stocks(user_id)
        
        return ApiResponse(
            code=200,
            message="success",
            data=symbols
        )
        
    except Exception as e:
        logger.error(f"Failed to get track list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watch/list")
async def get_watch_list(
    user_id: int = Query(..., description="User ID")
) -> ApiResponse[List[str]]:
    """Get user's watch layer stock list.
    
    Args:
        user_id: User ID
        
    Returns:
        List of stock symbols in watch layer
    """
    try:
        symbols = await redis_store.get_user_watch_stocks(user_id)
        
        return ApiResponse(
            code=200,
            message="success",
            data=symbols
        )
        
    except Exception as e:
        logger.error(f"Failed to get watch list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_tiered_stats() -> ApiResponse[dict]:
    """Get tiered watchlist system statistics.
    
    Returns:
        System statistics including queue stats, update counts, etc.
    """
    try:
        stats = scheduler.get_stats()
        
        return ApiResponse(
            code=200,
            message="success",
            data=stats
        )
        
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket for real-time track layer updates
@router.websocket("/ws/track/{user_id}")
async def track_websocket(websocket: WebSocket, user_id: int):
    """WebSocket endpoint for real-time track layer updates.
    
    Pushes real-time updates every 10 seconds for stocks in user's track layer.
    
    Args:
        websocket: WebSocket connection
        user_id: User ID
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for user {user_id}")
    
    try:
        while True:
            # Get user's track stocks
            track_symbols = await redis_store.get_user_track_stocks(user_id)
            
            if track_symbols:
                # Get real-time data for track stocks
                # In production, this would fetch from Redis
                data = {
                    "type": "track_update",
                    "symbols": track_symbols,
                    "timestamp": int(__import__('time').time())
                }
                await websocket.send_json(data)
            
            # Wait for next update cycle
            await __import__('asyncio').sleep(10)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await websocket.close()


@router.websocket("/ws/global")
async def global_websocket(websocket: WebSocket):
    """WebSocket endpoint for global track layer updates.
    
    Pushes all track layer stock updates (for admin/monitoring).
    
    Args:
        websocket: WebSocket connection
    """
    await websocket.accept()
    logger.info("Global WebSocket connected")
    
    try:
        while True:
            # In production, this would subscribe to Redis pub/sub
            data = {
                "type": "heartbeat",
                "timestamp": int(__import__('time').time())
            }
            await websocket.send_json(data)
            await __import__('asyncio').sleep(30)
            
    except WebSocketDisconnect:
        logger.info("Global WebSocket disconnected")
    except Exception as e:
        logger.error(f"Global WebSocket error: {e}")
        await websocket.close()
