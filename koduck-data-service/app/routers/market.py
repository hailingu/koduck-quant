"""Market API router.

Contains endpoints that expose market-wide information such as hot stocks and
major index quotations. All responses are wrapped in
``app.models.schemas.ApiResponse`` and errors are surfaced via
``fastapi.HTTPException`` with user-friendly messages.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    ApiResponse,
    MarketIndex,
    SymbolInfo,
)
from app.services.akshare_client import akshare_client

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
        Query("volume", description="sort type: volume | gain | loss"),
    ],
    limit: Annotated[int, Query(20, ge=1, le=100, description="maximum results")],
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
