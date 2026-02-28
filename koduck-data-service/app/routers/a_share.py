"""A-share market data router."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    ApiResponse,
    BatchPriceRequest,
    HealthStatus,
    HotSymbolsRequest,
    PriceQuote,
    SearchRequest,
    SymbolInfo,
)
from app.services.akshare_client import akshare_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/a-share", tags=["A-Share"])


@router.get("/search", response_model=ApiResponse[List[SymbolInfo]])
async def search_symbols(
    keyword: str = Query(..., min_length=1, description="搜索关键词（代码或名称）"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制")
):
    """Search A-share stocks by keyword.
    
    Args:
        keyword: Search keyword (stock name or symbol)
        limit: Maximum number of results (1-100)
        
    Returns:
        List of matching stock symbols
        
    Example:
        GET /api/v1/a-share/search?keyword=永太&limit=10
    """
    try:
        results = akshare_client.search_symbols(keyword, limit)
        return ApiResponse(data=results)
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/price/{symbol}", response_model=ApiResponse[PriceQuote])
async def get_price(symbol: str):
    """Get real-time price for a single A-share stock.
    
    Args:
        symbol: Stock symbol (e.g., '002326')
        
    Returns:
        Real-time price quote
        
    Raises:
        HTTPException: 404 if symbol not found, 500 on error
        
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
        logger.error(f"Price query error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Price query failed: {str(e)}")


@router.post("/price/batch", response_model=ApiResponse[List[PriceQuote]])
async def get_batch_prices(request: BatchPriceRequest):
    """Get real-time prices for multiple A-share stocks.
    
    Args:
        request: BatchPriceRequest with list of symbols
        
    Returns:
        List of price quotes for found symbols
        
    Example:
        POST /api/v1/a-share/price/batch
        {"symbols": ["002326", "000001", "600000"]}
    """
    try:
        prices = akshare_client.get_batch_prices(request.symbols)
        return ApiResponse(data=prices)
    except Exception as e:
        logger.error(f"Batch price query error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch query failed: {str(e)}")


@router.get("/hot", response_model=ApiResponse[List[SymbolInfo]])
async def get_hot_symbols(
    limit: int = Query(20, ge=1, le=50, description="返回数量限制")
):
    """Get hot A-share stocks sorted by trading amount.
    
    Args:
        limit: Number of hot stocks to return (1-50)
        
    Returns:
        List of hot stock symbols sorted by trading volume
        
    Example:
        GET /api/v1/a-share/hot?limit=20
    """
    try:
        hot = akshare_client.get_hot_symbols(limit)
        return ApiResponse(data=hot)
    except Exception as e:
        logger.error(f"Hot symbols query error: {e}")
        raise HTTPException(status_code=500, detail=f"Hot symbols query failed: {str(e)}")


@router.get("/market/status", response_model=ApiResponse[dict])
async def get_market_status():
    """Get A-share market status.
    
    Returns:
        Market status information
    """
    try:
        # TODO: Implement market status check
        # This could check if market is open, trading hours, etc.
        import akshare as ak
        
        # Get Shanghai index as market indicator
        df = ak.stock_zh_index_spot_em()
        sh_index = df[df['代码'] == '000001']
        
        status = {
            "market": "AShare",
            "is_trading": True,  # TODO: Implement trading hours check
            "shanghai_index": {
                "price": float(sh_index.iloc[0]['最新价']) if not sh_index.empty else None,
                "change_percent": float(sh_index.iloc[0]['涨跌幅']) if not sh_index.empty else None,
            } if not sh_index.empty else None
        }
        
        return ApiResponse(data=status)
    except Exception as e:
        logger.error(f"Market status query error: {e}")
        raise HTTPException(status_code=500, detail=f"Market status query failed: {str(e)}")
