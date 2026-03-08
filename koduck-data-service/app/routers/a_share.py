"""A-share market data router.

Provides endpoints for searching symbols, fetching prices, and
market status for the A-share market.
"""

import logging
from datetime import datetime, time, timezone
from typing import Annotated, List
from zoneinfo import ZoneInfo

import pandas as pd

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    ApiResponse,
    BatchPriceRequest,
    MarketIndex,
    PriceQuote,
    SymbolInfo
)
from app.services.akshare_client import akshare_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/a-share", tags=["A-Share"])

ERROR_INTERNAL_RETRY = "Internal server error. Please try again later."


def _is_a_share_trading_session(now_cn: datetime) -> bool:
    """Determine if a given Shanghai time is during trading hours.

    Args:
        now_cn (datetime): Current time in China (Asia/Shanghai timezone).

    Returns:
        bool: ``True`` if the timestamp falls on a weekday and within either the
            morning (09:30–11:30) or afternoon (13:00–15:00) session.
    """
    is_weekday = now_cn.weekday() < 5
    current_time = now_cn.time()
    in_morning_session = time(9, 30) <= current_time < time(11, 30)
    in_afternoon_session = time(13, 0) <= current_time < time(15, 0)
    return is_weekday and (in_morning_session or in_afternoon_session)


def _build_shanghai_index_snapshot(df: pd.DataFrame) -> dict[str, float] | None:
    """Extract a simplified snapshot for the Shanghai Composite index.

    The AKShare endpoint returns a DataFrame with Chinese column names. We locate
    the row whose "代码" column (stock code) equals ``'000001'`` (Shanghai Composite
    index) and return a small dictionary with the latest price and percentage change.

    Args:
        df (pandas.DataFrame): Raw DataFrame returned by ``ak.stock_zh_index_spot_em()``.

    Returns:
        Optional[dict[str, float]]: ``None`` if the index row is missing, otherwise
        a dict containing ``"price"`` and ``"change_percent"``.
    """
    sh_index = df[df["代码"] == "000001"]
    if sh_index.empty:
        return None

    sh_index_row = sh_index.iloc[0]
    return {
        "price": float(sh_index_row["最新价"]),
        "change_percent": float(sh_index_row["涨跌幅"]),
    }


@router.get(
    "/search",
    response_model=ApiResponse[List[SymbolInfo]],
    responses={500: {"description": "Internal server error"}},
)
async def search_symbols(
    keyword: Annotated[
        str,
        Query(..., min_length=1, description="search keyword (code or name)"),
    ],
    limit: Annotated[
        int,
        Query(ge=1, le=100, description="maximum number of results"),
    ] = 20,
):
    """Search A-share stocks by keyword.
    
    Args:
        keyword (str): Search keyword (stock name or symbol).
        limit (int): Maximum number of results, between 1 and 100.
        
    Returns:
        ApiResponse[List[SymbolInfo]]: Wrapped list of matching stock symbols. An
        empty list is returned when no match is found.
        
    Example:
        GET /api/v1/a-share/search?keyword=Yongtai&limit=10
    """
    try:
        results = akshare_client.search_symbols(keyword, limit)
        
        # Even if search returns empty, return empty list instead of error
        if not results:
            logger.info("Search returned no results", extra={"keyword": keyword})
            return ApiResponse(data=[])
        
        return ApiResponse(data=results)
    except Exception as e:
        logger.error(
            "Search error",
            exc_info=True,
            extra={"keyword": keyword, "error": str(e)},
        )
        # Return a user-friendly error message
        raise HTTPException(
            status_code=500,
            detail=ERROR_INTERNAL_RETRY,
        )


@router.get(
    "/price/{symbol}",
    response_model=ApiResponse[PriceQuote],
    responses={
        404: {"description": "Stock symbol not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_price(symbol: str):
    """Get real-time price for a single A-share stock.
    
    Args:
        symbol (str): Stock symbol (e.g., ``'002326'``).
        
    Returns:
        ApiResponse[PriceQuote]: Quote containing the latest price information.
        
    Raises:
        HTTPException: 404 if symbol not found, 500 for other errors.
        
    Example:
        GET /api/v1/a-share/price/002326
    """
    try:
        price = akshare_client.get_realtime_price(symbol)
        if not price:
            raise HTTPException(
                status_code=404,
                detail=f"Stock symbol '{symbol}' not found"
            )
        return ApiResponse(data=price)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Price query error", extra={"symbol": symbol, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Price query failed: {str(e)}")


@router.post(
    "/price/batch",
    response_model=ApiResponse[List[PriceQuote]],
    responses={500: {"description": "Internal server error"}},
)
async def get_batch_prices(request: BatchPriceRequest):
    """Get real-time prices for multiple A-share stocks.
    
    Args:
        request (BatchPriceRequest): Payload containing ``symbols`` list.
        
    Returns:
        ApiResponse[List[PriceQuote]]: Quotes for each symbol found.
        
    Example:
        POST /api/v1/a-share/price/batch
        {"symbols": ["002326", "000001", "600000"]}
    """
    try:
        prices = akshare_client.get_batch_prices(request.symbols)
        return ApiResponse(data=prices)
    except Exception as e:
        logger.error(
            "Batch price query error",
            extra={"symbols": request.symbols, "error": str(e)},
        )
        raise HTTPException(status_code=500, detail=f"Batch query failed: {str(e)}")


@router.get(
    "/indices",
    response_model=ApiResponse[List[MarketIndex]],
    responses={500: {"description": "Internal server error"}},
)
async def get_market_indices():
    """Get main market indices.
    
    Returns:
        ApiResponse[List[MarketIndex]]: A collection of major indices such as
        the Shanghai Composite Index, the Shenzhen Component Index, and the
        ChiNext Index.
        
    Example:
        GET /api/v1/a-share/indices
    """
    try:
        indices = akshare_client.get_market_indices()
        return ApiResponse(data=indices)
    except Exception as e:
        logger.error("Market indices query error", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Market indices query failed: {str(e)}")


@router.get(
    "/market/status",
    response_model=ApiResponse[dict],
    responses={500: {"description": "Internal server error"}},
)
async def get_market_status():
    """Get A-share market status.
    
    Returns:
        ApiResponse[dict]: Dictionary with ``market``, ``is_trading`` flag, and
        optional ``shanghai_index`` snapshot.
    """
    try:
        import akshare as ak

        now_cn = datetime.now(ZoneInfo("Asia/Shanghai"))
        is_trading = _is_a_share_trading_session(now_cn)
        
        # Get Shanghai index as market indicator
        df = ak.stock_zh_index_spot_em()
        shanghai_index = _build_shanghai_index_snapshot(df)
        
        status = {
            "market": "AShare",
            "is_trading": is_trading,
            "shanghai_index": shanghai_index,
        }
        
        return ApiResponse(data=status)
    except Exception as e:
        logger.error("Market status query error", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Market status query failed: {str(e)}")
