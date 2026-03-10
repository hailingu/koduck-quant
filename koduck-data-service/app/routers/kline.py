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
    if not klines:
        return klines
    
    # Make a copy to avoid modifying original
    result = [dict(item) for item in klines]
    n = len(result)
    
    # Calculate MA5 for each point
    # Since data is ordered newest first, we need to look ahead
    for i in range(n):
        # Check if we have 5 points starting from current position
        if i + 4 < n:
            # Get 5 close prices (current + next 4)
            closes = []
            for j in range(5):
                close_val = result[i + j].get('close')
                if close_val is not None:
                    closes.append(float(close_val))
            
            if len(closes) == 5:
                result[i]['ma5'] = round(sum(closes) / 5, 4)
            else:
                result[i]['ma5'] = None
        else:
            # Not enough data points
            result[i]['ma5'] = None
    
    return result


def _to_kline_data(klines: list[dict[str, Any]]) -> list[KlineData]:
    """Convert raw kline dictionaries to validated KlineData models."""
    # Calculate MA5 before validation
    klines_with_ma5 = _calculate_ma5(klines)
    return [KlineData.model_validate(item) for item in klines_with_ma5]


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

            return ApiResponse(data=_to_kline_data(klines))

        # Calculate date range based on limit and before_time
        end_date = None
        start_date = None

        if before_time is not None:
            end_date = datetime.fromtimestamp(before_time).strftime("%Y%m%d")

        # Estimate start date based on limit (generous estimate)
        if timeframe == "1D":
            days_needed = limit * 1.5  # Include weekends
            start = datetime.now() - timedelta(days=int(days_needed))
            start_date = start.strftime("%Y%m%d")
        elif timeframe == "1W":
            weeks_needed = limit * 1.5
            start = datetime.now() - timedelta(weeks=int(weeks_needed))
            start_date = start.strftime("%Y%m%d")
        else:  # 1M
            months_needed = limit * 1.5
            start = datetime.now() - timedelta(days=int(months_needed * 30))
            start_date = start.strftime("%Y%m%d")

        # Map timeframe to AKShare period
        period = PERIOD_MAP[timeframe]

        logger.debug(f"Fetching kline for {symbol}, period={period}, limit={limit}")

        # Fetch data from AKShare
        klines = await asyncio.to_thread(
            akshare_client.get_kline_data,
            symbol=symbol,
            period=period,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
        )

        # Filter by before_time if specified
        if before_time is not None and klines:
            klines = [k for k in klines if k["timestamp"] < before_time]

        # Limit results
        klines = klines[:limit]

        return ApiResponse(data=_to_kline_data(klines))

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Kline query error", exc_info=True, extra={"symbol": symbol})
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/kline/price",
    responses={
        404: {"description": "No kline data found"},
        500: {"description": "Internal server error"},
    },
)
async def get_latest_price(
    symbol: Annotated[str, Query(..., description="股票代码")],
) -> ApiResponse[dict]:
    """Return the most recent closing price for a stock.

    The endpoint fetches a single daily K-line point and extracts the closing
    price and timestamp.  It is primarily a convenience for UIs that only need
    the latest quote.

    Args:
        symbol (str): Stock symbol to query.

    Returns:
        :class:`~app.models.schemas.ApiResponse` whose ``data`` field is a
        dictionary containing ``symbol``, ``price``, ``timestamp``, and
        optional ``change``/``change_percent`` fields.

    Raises:
        HTTPException: 404 if no K-line data exists for the symbol.
        HTTPException: 500 on internal failures.

    Example:
        >>> GET /api/v1/a-share/kline/price?symbol=002326
    """
    try:
        # Get last 1 day of data
        klines = await asyncio.to_thread(
            akshare_client.get_kline_data,
            symbol=symbol,
            period="daily",
            limit=1,
        )

        if not klines:
            raise HTTPException(
                status_code=404, detail=f"No price data found for {symbol}"
            )

        latest = klines[0]

        return ApiResponse(
            data={
                "symbol": symbol,
                "price": latest["close"],
                "timestamp": latest["timestamp"],
                "change": latest.get("change"),
                "change_percent": latest.get("change_percent"),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Latest price query error", exc_info=True, extra={"symbol": symbol}
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.post(
    "/kline/incremental",
    responses={
        400: {"description": "Invalid parameters"},
        500: {"description": "Internal server error"},
    },
)
async def update_kline_incremental(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 002326)")],
    timeframe: Annotated[
        str,
        Query(description="时间周期: 1D, 1W, 1M"),
    ] = "1D",
    start_date: Annotated[
        str | None,
        Query(description="开始日期 (YYYYMMDD)，可选"),
    ] = None,
    end_date: Annotated[
        str | None,
        Query(description="结束日期 (YYYYMMDD)，可选"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=1000, description="返回数据条数")] = 300,
    dry_run: Annotated[
        bool,
        Query(description="预览模式，不写入数据库"),
    ] = False,
) -> ApiResponse[dict]:
    """Incrementally update K-line data for a stock.

    This endpoint:
    1. Checks existing local data range in the database
    2. Fetches only missing data from AKShare
    3. Merges with existing data (INSERT ... ON CONFLICT DO NOTHING)
    4. Returns update statistics

    When start_date is not provided, it automatically detects the latest local
    data and fetches only newer data.

    Args:
        symbol (str): Stock symbol, e.g. ``"002326"``.
        timeframe (str): Time interval. Valid values are ``"1D"``, ``"1W"``, ``"1M"``.
        start_date (str | None): Start date in YYYYMMDD format. If None, uses local max date.
        end_date (str | None): End date in YYYYMMDD format. If None, uses today.
        limit (int): Maximum number of data points to fetch (1–1000).
        dry_run (bool): If True, only return what would be updated without persisting.

    Returns:
        :class:`~app.models.schemas.ApiResponse` containing update statistics:
        - symbol: Stock symbol
        - timeframe: Timeframe used
        - records_added: Number of new records added
        - records_updated: Number of records updated
        - date_range: Date range of fetched data
        - data: Array of K-line data

    Raises:
        HTTPException: 400 if ``timeframe`` is invalid.
        HTTPException: 500 on backend failure.

    Example:
        >>> POST /api/v1/a-share/kline/incremental?symbol=002326&timeframe=1D
        >>> POST /api/v1/a-share/kline/incremental?symbol=002326&start_date=20240101&end_date=20240301&dry_run=true
    """
    try:
        # Validate timeframe
        valid_daily_timeframes = {"1D", "1W", "1M"}
        if timeframe not in valid_daily_timeframes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid timeframe for incremental update. "
                    f"Must be one of: {', '.join(valid_daily_timeframes)}"
                ),
            )

        # Perform incremental update
        result = await incremental_kline_updater.incremental_update(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            timeframe=timeframe,
            limit=limit,
            dry_run=dry_run,
        )

        return ApiResponse(data=result.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Incremental kline update error",
            exc_info=True,
            extra={"symbol": symbol, "timeframe": timeframe},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/scheduler/status")
async def get_scheduler_status() -> ApiResponse:
    """Get K-line scheduler status and statistics.
    
    Returns the current state of the background K-line update scheduler,
    including initialization status, last update time, and error counts.
    """
    from app.services.kline_scheduler import kline_scheduler
    
    return ApiResponse(data=kline_scheduler.get_status())


@router.post(
    "/kline/1m/incremental",
    responses={
        400: {"description": "Invalid parameters"},
        500: {"description": "Internal server error"},
    },
)
async def update_kline_1m_incremental(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 002326)")],
    days_back: Annotated[
        int,
        Query(ge=1, le=30, description="回溯天数 (1-30)"),
    ] = 7,
    dry_run: Annotated[
        bool,
        Query(description="预览模式，不写入数据库"),
    ] = False,
) -> ApiResponse[dict]:
    """Incrementally update 1-minute K-line data for a stock.

    This endpoint:
    1. Checks existing local 1-minute data range in CSV cache and database
    2. Fetches only missing data from AKShare
    3. Merges with existing data (INSERT ... ON CONFLICT DO NOTHING)
    4. Returns update statistics

    Note: AKShare's minute-level API returns recent data only (typically
    last few trading days). For historical 1-minute data spanning multiple
    months, use the backfill scripts.

    Args:
        symbol (str): Stock symbol, e.g. ``"002326"``.
        days_back (int): Number of days to look back for updates (1-30).
        dry_run (bool): If True, only return what would be updated without persisting.

    Returns:
        :class:`~app.models.schemas.ApiResponse` containing update statistics:
        - symbol: Stock symbol
        - records_added: Number of new records added to database
        - csv_records_added: Number of new records added to CSV cache
        - date_range: Date/time range of fetched data
        - trading_days: Approximate number of trading days covered

    Raises:
        HTTPException: 400 if parameters are invalid.
        HTTPException: 500 on backend failure.

    Example:
        >>> POST /api/v1/a-share/kline/1m/incremental?symbol=002326&days_back=7
        >>> POST /api/v1/a-share/kline/1m/incremental?symbol=002326&days_back=3&dry_run=true
    """
    try:
        # Perform incremental update using the 1-minute kline tool
        result = await minute1_kline_tool.incremental_update(
            symbol=symbol,
            days_back=days_back,
            dry_run=dry_run,
        )

        return ApiResponse(data=result.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "1-minute incremental kline update error",
            exc_info=True,
            extra={"symbol": symbol, "days_back": days_back},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get("/kline/1m/status")
async def get_kline_1m_status(
    symbol: Annotated[str, Query(..., description="股票代码 (如: 002326)")],
) -> ApiResponse[dict]:
    """Get 1-minute K-line data status for a stock.

    Returns the current data range, continuity status, and gap information
    for the specified stock's 1-minute K-line data.

    Args:
        symbol (str): Stock symbol to query.

    Returns:
        :class:`~app.models.schemas.ApiResponse` containing:
        - symbol: Stock symbol
        - is_continuous: Whether data is continuous (no gaps)
        - gap_count: Number of detected gaps
        - gaps: List of gap periods (if any)
        - total_records: Total number of records in cache
        - local_data_range: Min/max datetime of local data

    Raises:
        HTTPException: 500 on internal failures.

    Example:
        >>> GET /api/v1/a-share/kline/1m/status?symbol=002326
    """
    try:
        # Get validation results
        validation = minute1_kline_tool.validate_data_continuity(symbol)

        # Get local data range
        local_min, local_max = minute1_kline_tool._get_local_data_range(symbol)

        return ApiResponse(data={
            "symbol": symbol,
            "is_continuous": validation["is_continuous"],
            "gap_count": validation["gap_count"],
            "gaps": validation["gaps"],
            "total_records": validation["total_records"],
            "local_data_range": {
                "min": local_min.isoformat() if local_min else None,
                "max": local_max.isoformat() if local_max else None,
            },
            "validation_time": validation["validation_time"],
        })

    except Exception as e:
        logger.error(
            "1-minute kline status query error",
            exc_info=True,
            extra={"symbol": symbol},
        )
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
