"""BaoStock data API router.

This module implements endpoints that expose historical K-line data
fetched from BaoStock (https://www.baostock.com), a free and stable
A-share historical data provider. BaoStock offers data going back to
1990-12-19, making it an excellent source for long-term historical
analysis, especially monthly and weekly K-line data.

All handlers raise :class:`fastapi.HTTPException` for client errors or
infrastructure failures. Returned payloads use the
:class:`~app.models.schemas.ApiResponse` wrapper.
"""

import asyncio
import logging
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ApiResponse
from app.services.baostock_client import (
    ADJUST_NONE,
    baostock_client,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/baostock", tags=["BaoStock"])

VALID_FREQUENCIES = {
    "daily": "日K线",
    "weekly": "周K线",
    "monthly": "月K线",
}

VALID_ADJUSTFLAGS = {
    "1": "后复权",
    "2": "前复权",
    "3": "不复权",
}

ERROR_INTERNAL_RETRY = "Internal server error. Please try again later."


def _validate_adjustflag(adjustflag: str) -> str:
    """Validate and return the adjustment flag.

    Args:
        adjustflag: Adjustment flag string.

    Returns:
        Validated adjustment flag.

    Raises:
        HTTPException: 400 if the flag is invalid.
    """
    if adjustflag not in VALID_ADJUSTFLAGS:
        valid = ", ".join(f'"{k}" ({v})' for k, v in VALID_ADJUSTFLAGS.items())
        raise HTTPException(
            status_code=400,
            detail=f"Invalid adjustflag. Must be one of: {valid}",
        )
    return adjustflag


@router.get(
    "/kline/monthly",
    summary="获取月K线数据 (BaoStock)",
)
async def get_monthly_kline(
    symbol: Annotated[
        str,
        Query(
            ...,
            description="股票代码 (如: 601398, 000001, sh.600000)",
        ),
    ],
    start_date: Annotated[
        Optional[str],
        Query(description="开始日期 (YYYY-MM-DD)，默认从1990年开始"),
    ] = None,
    end_date: Annotated[
        Optional[str],
        Query(description="结束日期 (YYYY-MM-DD)，默认到今天"),
    ] = None,
    adjustflag: Annotated[
        str,
        Query(
            description="复权类型: 1=后复权, 2=前复权, 3=不复权 (默认)",
        ),
    ] = ADJUST_NONE,
    limit: Annotated[
        int,
        Query(ge=1, le=1000, description="返回数据条数 (从最新往前截取)"),
    ] = 300,
) -> ApiResponse[list[dict]]:
    """Get monthly K-line data from BaoStock.

    Fetches historical monthly OHLCV data from BaoStock, which provides
    data going back to 1990-12-19. This is an excellent data source for
    long-term technical analysis.

    Args:
        symbol (str): Stock symbol, e.g. ``"601398"`` (工商银行).
            Both plain 6-digit codes and BaoStock-format codes
            (``"sh.600000"``) are accepted.
        start_date (str | None): Start date filter (YYYY-MM-DD).
            Defaults to ``"1990-01-01"`` for full history.
        end_date (str | None): End date filter (YYYY-MM-DD).
            Defaults to today.
        adjustflag (str): Adjustment flag — ``"1"`` backward,
            ``"2"`` forward, ``"3"`` none (default).
        limit (int): Maximum number of records to return (1–1000).

    Returns:
        :class:`~app.models.schemas.ApiResponse` containing a list of
        monthly K-line dicts. Each dict includes:
        ``timestamp``, ``date``, ``open``, ``high``, ``low``,
        ``close``, ``volume``, ``amount``, and optionally ``turn``,
        ``pct_chg``.

    Raises:
        HTTPException: 400 on invalid parameters.
        HTTPException: 500 on backend failure.

    Example:
        >>> GET /api/v1/baostock/kline/monthly?symbol=601398&start_date=2020-01-01
        >>> GET /api/v1/baostock/kline/monthly?symbol=000001&adjustflag=2&limit=120
    """
    try:
        _validate_adjustflag(adjustflag)

        logger.info(
            "BaoStock monthly kline request: symbol=%s, start=%s, end=%s, "
            "adjustflag=%s, limit=%d",
            symbol, start_date, end_date, adjustflag, limit,
        )

        klines = await asyncio.to_thread(
            baostock_client.get_monthly_kline,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            adjustflag=adjustflag,
        )

        # Apply limit (take the most recent records)
        if len(klines) > limit:
            klines = klines[-limit:]

        return ApiResponse(data=klines)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "BaoStock monthly kline error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/kline/weekly",
    summary="获取周K线数据 (BaoStock)",
)
async def get_weekly_kline(
    symbol: Annotated[
        str,
        Query(
            ...,
            description="股票代码 (如: 601398, 000001, sh.600000)",
        ),
    ],
    start_date: Annotated[
        Optional[str],
        Query(description="开始日期 (YYYY-MM-DD)，默认从1990年开始"),
    ] = None,
    end_date: Annotated[
        Optional[str],
        Query(description="结束日期 (YYYY-MM-DD)，默认到今天"),
    ] = None,
    adjustflag: Annotated[
        str,
        Query(
            description="复权类型: 1=后复权, 2=前复权, 3=不复权 (默认)",
        ),
    ] = ADJUST_NONE,
    limit: Annotated[
        int,
        Query(ge=1, le=1000, description="返回数据条数"),
    ] = 300,
) -> ApiResponse[list[dict]]:
    """Get weekly K-line data from BaoStock.

    Args:
        symbol: Stock symbol (e.g. ``"601398"``).
        start_date: Start date filter (YYYY-MM-DD).
        end_date: End date filter (YYYY-MM-DD).
        adjustflag: Adjustment flag (default: no adjustment).
        limit: Maximum number of records (1–1000).

    Returns:
        ApiResponse containing weekly K-line data.

    Example:
        >>> GET /api/v1/baostock/kline/weekly?symbol=601398&limit=100
    """
    try:
        _validate_adjustflag(adjustflag)

        klines = await asyncio.to_thread(
            baostock_client.get_weekly_kline,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            adjustflag=adjustflag,
        )

        if len(klines) > limit:
            klines = klines[-limit:]

        return ApiResponse(data=klines)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "BaoStock weekly kline error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/kline/daily",
    summary="获取日K线数据 (BaoStock)",
)
async def get_daily_kline(
    symbol: Annotated[
        str,
        Query(
            ...,
            description="股票代码 (如: 601398, 000001, sh.600000)",
        ),
    ],
    start_date: Annotated[
        Optional[str],
        Query(description="开始日期 (YYYY-MM-DD)，默认从1990年开始"),
    ] = None,
    end_date: Annotated[
        Optional[str],
        Query(description="结束日期 (YYYY-MM-DD)，默认到今天"),
    ] = None,
    adjustflag: Annotated[
        str,
        Query(
            description="复权类型: 1=后复权, 2=前复权, 3=不复权 (默认)",
        ),
    ] = ADJUST_NONE,
    limit: Annotated[
        int,
        Query(ge=1, le=1000, description="返回数据条数"),
    ] = 300,
) -> ApiResponse[list[dict]]:
    """Get daily K-line data from BaoStock.

    Args:
        symbol: Stock symbol (e.g. ``"601398"``).
        start_date: Start date filter (YYYY-MM-DD).
        end_date: End date filter (YYYY-MM-DD).
        adjustflag: Adjustment flag (default: no adjustment).
        limit: Maximum number of records (1–1000).

    Returns:
        ApiResponse containing daily K-line data.

    Example:
        >>> GET /api/v1/baostock/kline/daily?symbol=601398&start_date=2024-01-01&limit=100
    """
    try:
        _validate_adjustflag(adjustflag)

        klines = await asyncio.to_thread(
            baostock_client.get_daily_kline,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            adjustflag=adjustflag,
        )

        if len(klines) > limit:
            klines = klines[-limit:]

        return ApiResponse(data=klines)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "BaoStock daily kline error",
            exc_info=True,
            extra={"symbol": symbol},
        )
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e


@router.get(
    "/health",
    summary="BaoStock 连接健康检查",
)
async def baostock_health_check() -> ApiResponse[dict]:
    """Check connectivity to BaoStock server.

    Performs a login/logout cycle to verify that the BaoStock data
    source is reachable and operational.

    Returns:
        ApiResponse containing ``status`` (``"ok"`` or ``"error"``)
        and ``message`` with details.
    """
    try:
        result = await asyncio.to_thread(baostock_client.check_health)
        return ApiResponse(data=result)
    except Exception as e:
        logger.error("BaoStock health check error", exc_info=True)
        raise HTTPException(status_code=500, detail=ERROR_INTERNAL_RETRY) from e
