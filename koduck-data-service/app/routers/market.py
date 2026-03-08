"""Market API router.

Contains endpoints that expose market-wide information such as hot stocks and
major index quotations. All responses are wrapped in
``app.models.schemas.ApiResponse`` and errors are surfaced via
``fastapi.HTTPException`` with user-friendly messages.
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    ApiResponse,
    BatchPriceRequest,
    MarketIndex,
    PriceQuote,
    SymbolInfo,
)
from app.services.akshare_client import akshare_client
from app.services.data_updater import data_updater
from app.services.tick_history_service import tick_history_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["Market"])

ERROR_INTERNAL_RETRY: str = "Internal server error. Please try again later."
"""Default error message returned when an unexpected failure occurs.

This string is deliberately generic so that internal details are not leaked
to API consumers.  Individual endpoints may log the original exception for
troubleshooting.
"""


@router.get(
    "/hot",
    response_model=ApiResponse[list[SymbolInfo]],
    responses={500: {"description": "Internal server error"}},
)
async def get_hot_stocks(
    sort_type: Annotated[
        str,
        Query(description="sort type: volume | gain | loss"),
    ] = "volume",
    limit: Annotated[int, Query(ge=1, le=100, description="maximum results")] = 20,
):
    """Get hot stocks sorted by volume or change percent.

    Args:
        sort_type (str): Sorting key. ``"volume"`` for volume, ``"gain"`` for
            top gainers, ``"loss"`` for top losers.
        limit (int): Maximum number of symbols to return (1-100).

    Returns:
        ApiResponse containing a list of
        :class:`~app.models.schemas.SymbolInfo` objects.

    Example:
        GET /api/v1/market/hot?type=volume&limit=10
        GET /api/v1/market/hot?type=gain&limit=5
    """
    try:
        results = akshare_client.get_hot_stocks(sort_type=sort_type, limit=limit)
        return ApiResponse(data=results)
    except Exception as e:
        logger.error("Hot stocks query error", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/indices",
    response_model=ApiResponse[list[MarketIndex]],
    responses={500: {"description": "Internal server error"}},
)
async def get_market_indices():
    """Retrieve major A-share market indices.

    Returns:
        ApiResponse containing a list of
        :class:`~app.models.schemas.MarketIndex` objects.

    Example:
        GET /api/v1/market/indices
    """
    try:
        indices = akshare_client.get_market_indices()
        return ApiResponse(data=indices)
    except Exception as e:
        logger.error("Market indices query error", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/ticks/{symbol}",
    response_model=ApiResponse[dict],
    responses={500: {"description": "Internal server error"}},
)
async def get_tick_history(
    symbol: str,
    start: Annotated[
        Optional[datetime],
        Query(description="Start time (ISO 8601 format)")
    ] = None,
    end: Annotated[
        Optional[datetime],
        Query(description="End time (ISO 8601 format)")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=10000, description="Maximum records per page")
    ] = 1000,
    offset: Annotated[
        int,
        Query(ge=0, description="Offset for pagination")
    ] = 0,
):
    """Get tick history for a specific symbol within a time range.
    
    Args:
        symbol: Stock symbol (e.g., "601398")
        start: Start time (defaults to 1 day ago)
        end: End time (defaults to now)
        limit: Maximum number of records to return (1-10000)
        offset: Offset for pagination
        
    Returns:
        ApiResponse containing tick history data with pagination info.
        
    Example:
        GET /api/v1/market/ticks/601398?start=2026-03-01T09:30:00&end=2026-03-01T15:00:00&limit=100
    """
    try:
        result = await tick_history_service.get_ticks(
            symbol=symbol,
            start_time=start,
            end_time=end,
            limit=limit,
            offset=offset,
        )
        
        return ApiResponse(
            data={
                "symbol": symbol,
                "ticks": result.data,
                "pagination": {
                    "total": result.total,
                    "page": result.page,
                    "page_size": result.page_size,
                    "has_more": result.has_more,
                },
            }
        )
    except Exception as e:
        logger.error(f"Tick history query error for {symbol}", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/ticks/{symbol}/latest",
    response_model=ApiResponse[dict],
    responses={500: {"description": "Internal server error"}},
)
async def get_latest_ticks(
    symbol: str,
    limit: Annotated[
        int,
        Query(ge=1, le=1000, description="Maximum records to return")
    ] = 100,
):
    """Get the most recent tick history records for a symbol.
    
    Args:
        symbol: Stock symbol (e.g., "601398")
        limit: Maximum number of records to return (1-1000)
        
    Returns:
        ApiResponse containing the most recent tick records.
        
    Example:
        GET /api/v1/market/ticks/601398/latest?limit=50
    """
    try:
        ticks = await tick_history_service.get_latest_ticks(symbol, limit)
        
        return ApiResponse(
            data={
                "symbol": symbol,
                "ticks": ticks,
                "count": len(ticks),
            }
        )
    except Exception as e:
        logger.error(f"Latest ticks query error for {symbol}", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/ticks/{symbol}/statistics",
    response_model=ApiResponse[dict],
    responses={500: {"description": "Internal server error"}},
)
async def get_tick_statistics(
    symbol: str,
    start: Annotated[
        Optional[datetime],
        Query(description="Start time (ISO 8601 format)")
    ] = None,
    end: Annotated[
        Optional[datetime],
        Query(description="End time (ISO 8601 format)")
    ] = None,
):
    """Get statistics for tick data in a time range.
    
    Args:
        symbol: Stock symbol (e.g., "601398")
        start: Start time (defaults to 1 day ago)
        end: End time (defaults to now)
        
    Returns:
        ApiResponse containing tick statistics.
        
    Example:
        GET /api/v1/market/ticks/601398/statistics?start=2026-03-01T09:30:00&end=2026-03-01T15:00:00
    """
    try:
        stats = await tick_history_service.get_statistics(symbol, start, end)
        
        return ApiResponse(
            data={
                "symbol": stats.symbol,
                "time_range": {
                    "start": stats.start_time.isoformat() if stats.start_time else None,
                    "end": stats.end_time.isoformat() if stats.end_time else None,
                },
                "count": stats.count,
                "price": {
                    "avg": stats.avg_price,
                    "max": stats.max_price,
                    "min": stats.min_price,
                    "change": stats.price_change,
                    "change_percent": stats.price_change_percent,
                },
                "volume": {
                    "total": stats.total_volume,
                    "total_amount": stats.total_amount,
                },
            }
        )
    except Exception as e:
        logger.error(f"Tick statistics query error for {symbol}", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.post(
    "/realtime/update",
    response_model=ApiResponse[dict],
    responses={500: {"description": "Internal server error"}},
)
async def request_realtime_update(request: BatchPriceRequest):
    """Request realtime update for specified stock symbols.

    This endpoint allows external systems (e.g., Java backend) to request
    immediate realtime data updates for specific stock symbols. The updates
    are performed asynchronously in the background.

    Args:
        request: BatchPriceRequest containing list of symbols to update.

    Returns:
        ApiResponse with update status and results for each symbol.

    Example:
        POST /api/v1/market/realtime/update
        Body: {"symbols": ["601398", "600000", "000001"]}
    """
    symbols = request.symbols
    
    if not symbols:
        raise HTTPException(
            status_code=400,
            detail="At least one symbol is required"
        )
    
    if len(symbols) > 50:
        raise HTTPException(
            status_code=400,
            detail="Maximum 50 symbols allowed per request"
        )
    
    logger.info(f"Realtime update requested for {len(symbols)} symbols: {symbols}")
    
    results = []
    for symbol in symbols:
        try:
            data = await data_updater.update_single_stock(symbol)
            if data:
                results.append({
                    "symbol": symbol,
                    "success": True,
                    "price": data.get("price"),
                })
            else:
                results.append({
                    "symbol": symbol,
                    "success": False,
                    "error": "No data returned from data source",
                })
        except Exception as e:
            logger.error(f"Failed to update {symbol}", exc_info=True)
            results.append({
                "symbol": symbol,
                "success": False,
                "error": str(e),
            })
    
    success_count = sum(1 for r in results if r["success"])
    
    return ApiResponse(
        data={
            "requested": len(symbols),
            "successful": success_count,
            "failed": len(symbols) - success_count,
            "results": results,
        },
        message=f"Updated {success_count}/{len(symbols)} symbols"
    )
