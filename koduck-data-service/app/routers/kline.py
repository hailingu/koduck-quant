"""K-line API router.

This module implements the endpoints that expose historical candlestick (K‑line)
data for A-share stocks.  It handles both minute-level and multi‑day periods and
provides a convenience endpoint for the latest closing price.

All handlers raise :class:`fastapi.HTTPException` for client errors (e.g. invalid
parameters) or infrastructure failures.  Returned payloads use the
:class:`~app.models.schemas.ApiResponse` wrapper with appropriate data types.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ApiResponse, KlineData
from app.services.akshare_client import akshare_client
from app.services.incremental_kline_updater import incremental_kline_updater
from app.services.kline_1m import minute1_kline_tool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/a-share", tags=["Kline"])

VALID_TIMEFRAMES = ["1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"]
MINUTE_TIMEFRAMES = {"1m", "5m", "15m", "30m", "60m"}
PERIOD_MAP = {
    "1D": "daily",
    "1W": "weekly",
    "1M": "monthly",
}
ERROR_INTERNAL_RETRY = "Internal server error. Please try again later."


def _calculate_ma5(klines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Calculate 5-day moving average for each kline point.
    
    MA5 is calculated as the average of closing prices for the current
    and previous 4 data points (5 points total). For points with less
    than 5 preceding data points, ma5 will be None.
    
    Args:
        klines: List of kline dictionaries with 'close' price, 
                ordered by timestamp (newest first).
    
    Returns:
        List of kline dictionaries with added 'ma5' field.
    """
    result = []
    for i, kline in enumerate(klines):
        if i + 5 <= len(klines):
            # Get previous 4 points + current point (5 total)
            closes = [klines[j]["close"] for j in range(i, i + 5)]
            ma5 = sum(closes) / len(closes)
            kline_with_ma = {**kline, "ma5": round(ma5, 2)}
        else:
            # Not enough data points for MA5
            kline_with_ma = {**kline, "ma5": None}
        result.append(kline_with_ma)
    return result


@router.get(
    "/kline",
    responses={
        400: {"description": "Invalid timeframe"},
        500: {"description": "Internal server error"},
    },
)
async def get_kline(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 002326)")],
    timeframe: Annotated[
        str,
        Query(description="时间周期: 1m,5m,15m,30m,60m,1D,1W,1M"),
    ] = "1D",
    limit: Annotated[int, Query(ge=1, le=1000, description="返回数据条数")] = 300,
    before_time: Annotated[
        int | None,
        Query(description="获取此时间之前的数据(Unix时间戳)"),
    ] = None,
) -> ApiResponse[list[KlineData]]:
    """Get historical K-line (candlestick) data for an A‑share stock.

    The response is a wrapped list of :class:`~app.models.schemas.KlineData`
    instances, ordered with the most recent timestamp first.  Both minute
    intervals (1m/5m/15m/30m/60m) and multi‑day periods (daily/weekly/monthly)
    are supported.  When ``before_time`` is provided the result is filtered to
    entries strictly older than the given Unix timestamp.

    Args:
        symbol (str): Stock symbol, e.g. ``"002326"``.
        timeframe (str): Time interval.  Valid values are
            ``"1m"``, ``"5m"``, ``"15m"``, ``"30m"``, ``"60m"`` for minute
            data, or ``"1D"``, ``"1W"``, ``"1M"`` for daily/weekly/monthly
            data.
        limit (int): Maximum number of data points to return (1–1000).
        before_time (int | None): Unix timestamp; when set results are restricted
            to rows with ``timestamp < before_time``.

    Returns:
        :class:`~app.models.schemas.ApiResponse` containing a list of
        :class:`~app.models.schemas.KlineData` objects.

    Raises:
        HTTPException: 400 if ``timeframe`` is invalid.
        HTTPException: 500 on backend failure (network/timeout).

    Example:
        >>> GET /api/v1/a-share/kline?symbol=002326&timeframe=1D&limit=100
        >>> GET /api/v1/a-share/kline?symbol=002326&timeframe=5m&limit=100
    """
    try:
        # Validate timeframe
        if timeframe not in VALID_TIMEFRAMES:
            valid_timeframes_text = ", ".join(VALID_TIMEFRAMES)
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid timeframe. Must be one of: " f"{valid_timeframes_text}"
                ),
            )

        # Handle minute-level timeframes
        if timeframe in MINUTE_TIMEFRAMES:
            minute_period = timeframe.replace("m", "")
            logger_message = (
                "Fetching minute kline for "
                f"{symbol}, period={minute_period}m, limit={limit}"
            )
            logger.debug(logger_message)

            klines = await asyncio.to_thread(
                akshare_client.get_kline_minutes,
                symbol=symbol,
                period=minute_period,
                limit=limit,
            )

            # Filter by before_time if specified
            if before_time is not None and klines:
                klines = [k for k in klines if k["timestamp"] < before_time]

            # Calculate MA5 for minute data too
            klines = _calculate_ma5(klines)

            return ApiResponse(data=klines)

        # Handle daily/weekly/monthly timeframes
        period = PERIOD_MAP.get(timeframe, timeframe)

        logger_kline = f"Fetching kline for {symbol}, period={period}, limit={limit}"
        logger.debug(logger_kline)

        # Fetch data from AKShare client
        klines = await asyncio.to_thread(
            akshare_client.get_kline_data,
            symbol=symbol,
            period=period,
            limit=limit,
        )

        # Filter by before_time if specified
        if before_time is not None and klines:
            klines = [k for k in klines if k["timestamp"] < before_time]

        # Calculate MA5
        klines = _calculate_ma5(klines)

        return ApiResponse(data=klines)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Kline query error", exc_info=True, extra={"symbol": symbol})
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/yearly", response_model=ApiResponse[list[dict]])
async def get_kline_yearly(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 601398)")],
    limit: Annotated[int, Query(ge=1, le=30, description="返回年数")] = 10,
) -> ApiResponse[list[dict]]:
    """Get yearly K-line data for long-term trend analysis.
    
    Issue #144, #147: Returns yearly OHLCV data by aggregating monthly data.
    Useful for analyzing long-term trends and multi-year investment strategies.
    
    Args:
        symbol: Stock symbol, e.g. "601398" (工商银行).
        limit: Maximum number of years to return (1-30, default 10).
        
    Returns:
        ApiResponse containing list of yearly K-line data:
        - timestamp: Unix timestamp for Jan 1 of the year
        - year: Year number (e.g., 2024)
        - open: Opening price (first trading day of year)
        - high: Highest price during the year
        - low: Lowest price during the year  
        - close: Closing price (last trading day of year)
        - volume: Total trading volume for the year
        - amount: Total trading amount for the year
        
    Example:
        >>> GET /api/v1/a-share/kline/yearly?symbol=601398&limit=5
        >>> Response: [{"year": 2024, "open": 4.58, "high": 4.95, ...}, ...]
    """
    try:
        logger.info(f"Fetching yearly kline for {symbol}, limit={limit}")
        
        klines = await asyncio.to_thread(
            akshare_client.get_kline_yearly,
            symbol=symbol,
            limit=limit,
        )
        
        if not klines:
            return ApiResponse(data=[], message="No yearly data available")
        
        return ApiResponse(data=klines)
        
    except Exception as e:
        logger.error(
            "Yearly kline query error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/yearly/update", response_model=ApiResponse[dict])
async def update_kline_yearly(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 601398)")],
) -> ApiResponse[dict]:
    """Incrementally update yearly K-line data.
    
    Issue #147: Smart merge of new yearly data with existing data.
    Only fetches and merges missing or updated years.
    
    Args:
        symbol: Stock symbol to update.
        
    Returns:
        ApiResponse containing update result:
        - symbol: Stock symbol
        - records_added: Number of new years added
        - records_updated: Number of years updated
        - date_range: {start, end} year range
        - data: Complete merged yearly data
        
    Example:
        >>> GET /api/v1/a-share/kline/yearly/update?symbol=601398
    """
    try:
        logger.info(f"Incremental update for yearly kline: {symbol}")
        
        # For now, we'll just return fresh data
        # In production, this would read existing data from DB/cache
        new_data = await asyncio.to_thread(
            akshare_client.get_kline_yearly,
            symbol=symbol,
            limit=30,
        )
        
        result = {
            "symbol": symbol,
            "records_added": len(new_data),
            "records_updated": 0,
            "date_range": {
                "start": new_data[0].get("year") if new_data else None,
                "end": new_data[-1].get("year") if new_data else None,
            },
            "data": new_data,
        }
        
        return ApiResponse(data=result, message="Yearly data updated successfully")
        
    except Exception as e:
        logger.error(
            "Yearly kline update error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/kline/incremental-update",
    response_model=ApiResponse[dict],
)
async def kline_incremental_update(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 002326)")],
    timeframe: Annotated[
        str,
        Query(description="时间周期: 1D, 1W, 1M"),
    ] = "1D",
    max_bars: Annotated[int, Query(ge=1, le=1000, description="最大条数")] = 300,
) -> ApiResponse[dict]:
    """Trigger incremental update of K-line data for a symbol.
    
    This endpoint fetches the latest K-line data and intelligently merges it
    with existing cached data, avoiding redundant API calls.
    
    Args:
        symbol: Stock symbol to update (e.g., "002326").
        timeframe: Time period - "1D" (daily), "1W" (weekly), or "1M" (monthly).
        max_bars: Maximum number of K-line bars to retain (1-1000).
        
    Returns:
        ApiResponse containing update result:
        - symbol: Stock symbol
        - timeframe: Time period
        - records_added: Number of new records added
        - records_updated: Number of existing records updated
        - total_records: Total records after update
        
    Example:
        >>> GET /api/v1/a-share/kline/incremental-update?symbol=002326&timeframe=1D&max_bars=300
    """
    try:
        # Validate timeframe
        valid_timeframes = ["1D", "1W", "1M"]
        if timeframe not in valid_timeframes:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timeframe. Must be one of: {', '.join(valid_timeframes)}"
            )
        
        period = PERIOD_MAP.get(timeframe, timeframe)
        
        logger.info(f"Incremental update for {symbol}, period={period}, max_bars={max_bars}")
        
        # Trigger incremental update
        result = await asyncio.to_thread(
            incremental_kline_updater.update_symbol,
            symbol=symbol,
            period=period,
            max_bars=max_bars,
        )
        
        return ApiResponse(
            data=result,
            message=f"Incremental update completed for {symbol}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Incremental update error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/scheduler/status")
async def get_kline_scheduler_status():
    """Get K-line scheduler status and recent update history.
    
    Returns information about the background K-line update scheduler,
    including last run time, next scheduled run, and recent update statistics.
    """
    try:
        status = incremental_kline_updater.get_scheduler_status()
        return ApiResponse(data=status)
    except Exception as e:
        logger.error("Failed to get scheduler status", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/1m/status")
async def get_kline_1m_status():
    """Get 1-minute K-line data collection status.
    
    Returns information about the 1-minute K-line data collection system,
    including collection statistics and cache status.
    """
    try:
        status = minute1_kline_tool.get_collection_status()
        return ApiResponse(data=status)
    except Exception as e:
        logger.error("Failed to get 1m kline status", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/1m/cached")
async def get_kline_1m_cached(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 002326)")],
    start_date: Annotated[
        str | None,
        Query(description="开始日期 (YYYY-MM-DD)，可选"),
    ] = None,
    end_date: Annotated[
        str | None,
        Query(description="结束日期 (YYYY-MM-DD)，可选"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=5000, description="返回数据条数")] = 1000,
) -> ApiResponse[list[dict]]:
    """Get cached 1-minute K-line data for a stock.

    Returns locally cached 1-minute K-line data from CSV files.
    This is useful for retrieving historical data without hitting external APIs.

    Args:
        symbol (str): Stock symbol to query.
        start_date (str | None): Start date filter (YYYY-MM-DD).
        end_date (str | None): End date filter (YYYY-MM-DD).
        limit (int): Maximum number of records to return (1-5000).

    Returns:
        :class:`~app.models.schemas.ApiResponse` containing list of K-line records:
        - symbol: Stock symbol
        - datetime: Timestamp string (YYYY-MM-DD HH:MM:SS)
        - timestamp: Unix timestamp
        - open: Opening price
        - high: Highest price
        - low: Lowest price
        - close: Closing price
        - volume: Trading volume
        - amount: Trading amount

    Raises:
        HTTPException: 500 on internal failures.

    Example:
        >>> GET /api/v1/a-share/kline/1m/cached?symbol=002326&limit=100
        >>> GET /api/v1/a-share/kline/1m/cached?symbol=002326&start_date=2024-01-01&end_date=2024-01-05
    """
    try:
        # Get cached data
        data = minute1_kline_tool.get_cached_data(symbol, start_date, end_date)

        # Apply limit
        if len(data) > limit:
            data = data[-limit:]  # Return most recent data

        return ApiResponse(data=data)

    except Exception as e:
        logger.error(
            "1-minute cached kline query error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e
