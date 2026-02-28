"""K-line data router."""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ApiResponse, KlineData, KlineRequest
from app.services.akshare_client import akshare_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/a-share", tags=["Kline"])


@router.get("/kline", response_model=ApiResponse[List[KlineData]])
async def get_kline(
    symbol: str = Query(..., description="股票代码 (如: 002326)"),
    timeframe: str = Query("1D", description="时间周期: 1D=日线, 1W=周线, 1M=月线"),
    limit: int = Query(300, ge=1, le=1000, description="返回数据条数"),
    before_time: Optional[int] = Query(None, description="获取此时间之前的数据(Unix时间戳)")
):
    """Get K-line (candlestick) historical data for A-share stocks.
    
    Args:
        symbol: Stock symbol (e.g., '002326')
        timeframe: Time period - '1D' (daily), '1W' (weekly), '1M' (monthly)
        limit: Maximum number of data points (1-1000)
        before_time: Get data before this Unix timestamp (optional)
        
    Returns:
        List of K-line data points sorted by timestamp descending
        
    Example:
        GET /api/v1/a-share/kline?symbol=002326&timeframe=1D&limit=100
    """
    try:
        # Validate timeframe
        valid_timeframes = ["1D", "1W", "1M"]
        if timeframe not in valid_timeframes:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timeframe. Must be one of: {', '.join(valid_timeframes)}"
            )
        
        # Calculate date range based on limit and before_time
        end_date = None
        start_date = None
        
        if before_time:
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
        period_map = {
            "1D": "daily",
            "1W": "weekly",
            "1M": "monthly"
        }
        period = period_map[timeframe]
        
        logger.debug(f"Fetching kline for {symbol}, period={period}, limit={limit}")
        
        # Fetch data from AKShare
        klines = akshare_client.get_kline_data(
            symbol=symbol,
            period=period,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        
        # Filter by before_time if specified
        if before_time and klines:
            klines = [k for k in klines if k["timestamp"] < before_time]
        
        # Limit results
        klines = klines[:limit]
        
        return ApiResponse(data=klines)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Kline query error: {e}")
        raise HTTPException(status_code=500, detail=f"Kline query failed: {str(e)}")


@router.get("/kline/price", response_model=ApiResponse[dict])
async def get_latest_price(
    symbol: str = Query(..., description="股票代码")
):
    """Get the latest price for a stock (from K-line data).
    
    This is a convenience endpoint that returns the most recent
    closing price from K-line data.
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Latest price information
        
    Example:
        GET /api/v1/a-share/kline/price?symbol=002326
    """
    try:
        # Get last 1 day of data
        klines = akshare_client.get_kline_data(symbol=symbol, period="daily", limit=1)
        
        if not klines:
            raise HTTPException(status_code=404, detail=f"No price data found for {symbol}")
        
        latest = klines[0]
        
        return ApiResponse(data={
            "symbol": symbol,
            "price": latest["close"],
            "timestamp": latest["timestamp"],
            "change": latest.get("change"),
            "change_percent": latest.get("change_percent")
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Latest price query error: {e}")
        raise HTTPException(status_code=500, detail=f"Price query failed: {str(e)}")
