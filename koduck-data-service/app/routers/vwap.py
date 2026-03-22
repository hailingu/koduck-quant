"""VWAP (Volume Weighted Average Price) API routes.

Issue #212: VWAP 指标计算 API
Provides VWAP calculation for technical analysis.
"""

import logging
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/indicators", tags=["indicators"])


# ============================================================================
# Models
# ============================================================================

class VWAPDataPoint(BaseModel):
    """Single VWAP data point."""
    timestamp: int = Field(..., description="Unix timestamp")
    datetime: str = Field(..., description="ISO datetime string")
    vwap: float = Field(..., description="VWAP value")
    close: float = Field(..., description="Close price")
    volume: float = Field(..., description="Volume")
    typical_price: float = Field(..., description="Typical price (H+L+C)/3")
    cumulative_typical_volume: float = Field(..., description="Cumulative typical * volume")
    cumulative_volume: float = Field(..., description="Cumulative volume")


class VWAPResponse(BaseModel):
    """VWAP indicator response."""
    symbol: str = Field(..., description="Stock symbol")
    market: str = Field(..., description="Market type")
    indicator: str = Field(..., default="VWAP", description="Indicator name")
    period: int = Field(..., description="Calculation period")
    current_value: float = Field(..., description="Current VWAP value")
    current_price: float = Field(..., description="Current price")
    price_vs_vwap: float = Field(..., description="Price deviation from VWAP (%)")
    trend: str = Field(..., description="Trend: above/below/crossing")
    history: List[VWAPDataPoint] = Field(..., description="Historical VWAP data")
    bands: Optional[dict] = Field(None, description="VWAP bands (upper/lower)")
    timestamp: str = Field(..., description="Data timestamp")


class VWAPComparison(BaseModel):
    """VWAP comparison between multiple stocks."""
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    vwap: float = Field(..., description="Current VWAP")
    price: float = Field(..., description="Current price")
    deviation: float = Field(..., description="Price deviation from VWAP (%)")
    signal: str = Field(..., description="Trading signal")


# ============================================================================
# Helper Functions
# ============================================================================

def calculate_vwap(data: List[dict]) -> List[dict]:
    """
    Calculate VWAP (Volume Weighted Average Price).
    
    Formula: VWAP = Σ(Typical Price × Volume) / Σ(Volume)
    Typical Price = (High + Low + Close) / 3
    
    Args:
        data: List of OHLCV data points
        
    Returns:
        List of data points with VWAP values
    """
    cumulative_tp_vol = 0.0
    cumulative_vol = 0.0
    result = []
    
    for item in data:
        high = item.get('high', item.get('close', 0))
        low = item.get('low', item.get('close', 0))
        close = item.get('close', 0)
        volume = item.get('volume', 0)
        
        # Calculate typical price
        typical_price = (high + low + close) / 3
        
        # Update cumulative values
        tp_vol = typical_price * volume
        cumulative_tp_vol += tp_vol
        cumulative_vol += volume
        
        # Calculate VWAP
        vwap = cumulative_tp_vol / cumulative_vol if cumulative_vol > 0 else typical_price
        
        result.append({
            **item,
            'typical_price': round(typical_price, 4),
            'vwap': round(vwap, 4),
            'cumulative_typical_volume': round(cumulative_tp_vol, 4),
            'cumulative_volume': round(cumulative_vol, 4)
        })
    
    return result


def generate_mock_kline_data(symbol: str, periods: int = 20) -> List[dict]:
    """Generate mock OHLCV data for VWAP calculation."""
    import random
    
    base_price = random.uniform(50, 2000)
    data = []
    
    for i in range(periods):
        # Generate random price movement
        change = random.uniform(-0.02, 0.02)
        close = base_price * (1 + change)
        high = close * (1 + random.uniform(0, 0.01))
        low = close * (1 - random.uniform(0, 0.01))
        open_price = close * (1 + random.uniform(-0.005, 0.005))
        volume = random.uniform(1000000, 10000000)
        
        data.append({
            'timestamp': int(datetime.now().timestamp()) - (periods - i) * 300,
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close, 2),
            'volume': round(volume, 2)
        })
        
        base_price = close
    
    return data


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/{symbol}/vwap", response_model=ApiResponse[VWAPResponse])
async def get_vwap(
    symbol: str,
    market: str = Query("AShare", description="Market type: AShare, USStock, HKStock"),
    period: int = Query(20, ge=5, le=120, description="VWAP calculation period")
):
    """Get VWAP (Volume Weighted Average Price) indicator.
    
    Issue #212: Returns VWAP calculation based on price and volume data.
    
    VWAP is calculated as: Σ(Typical Price × Volume) / Σ(Volume)
    Where Typical Price = (High + Low + Close) / 3
    
    Args:
        symbol: Stock symbol
        market: Market type
        period: Calculation period (number of data points)
        
    Returns:
        VWAPResponse with current value and historical data.
    """
    try:
        # Generate mock OHLCV data
        kline_data = generate_mock_kline_data(symbol, periods=period)
        
        # Calculate VWAP
        vwap_data = calculate_vwap(kline_data)
        
        if not vwap_data:
            raise HTTPException(status_code=404, detail="No data available for VWAP calculation")
        
        # Get current values
        current = vwap_data[-1]
        current_vwap = current['vwap']
        current_price = current['close']
        
        # Calculate price vs VWAP deviation
        price_vs_vwap = ((current_price - current_vwap) / current_vwap) * 100
        
        # Determine trend
        if abs(price_vs_vwap) < 0.5:
            trend = "neutral"
        elif price_vs_vwap > 0:
            trend = "above"
        else:
            trend = "below"
        
        # Calculate VWAP bands (1% and 2% deviations)
        bands = {
            "upper_1": round(current_vwap * 1.01, 2),
            "lower_1": round(current_vwap * 0.99, 2),
            "upper_2": round(current_vwap * 1.02, 2),
            "lower_2": round(current_vwap * 0.98, 2)
        }
        
        # Convert to response model
        history = [
            VWAPDataPoint(
                timestamp=d['timestamp'],
                datetime=datetime.fromtimestamp(d['timestamp'], timezone.utc).isoformat(),
                vwap=d['vwap'],
                close=d['close'],
                volume=d['volume'],
                typical_price=d['typical_price'],
                cumulative_typical_volume=d['cumulative_typical_volume'],
                cumulative_volume=d['cumulative_volume']
            )
            for d in vwap_data
        ]
        
        result = VWAPResponse(
            symbol=symbol,
            market=market,
            indicator="VWAP",
            period=period,
            current_value=round(current_vwap, 2),
            current_price=round(current_price, 2),
            price_vs_vwap=round(price_vs_vwap, 2),
            trend=trend,
            history=history,
            bands=bands,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to calculate VWAP for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vwap/batch")
async def get_vwap_batch(
    symbols: str = Query(..., description="Comma-separated stock symbols"),
    market: str = Query("AShare", description="Market type")
):
    """Get VWAP for multiple stocks (batch request).
    
    Args:
        symbols: Comma-separated stock symbols (e.g., "600519,000858,300750")
        market: Market type
        
    Returns:
        List of VWAP comparisons.
    """
    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        results = []
        
        for symbol in symbol_list[:10]:  # Limit to 10 symbols
            kline_data = generate_mock_kline_data(symbol, periods=20)
            vwap_data = calculate_vwap(kline_data)
            
            if vwap_data:
                current = vwap_data[-1]
                vwap = current['vwap']
                price = current['close']
                deviation = ((price - vwap) / vwap) * 100
                
                # Generate signal
                if deviation > 2:
                    signal = "卖出"
                elif deviation < -2:
                    signal = "买入"
                else:
                    signal = "持有"
                
                results.append(VWAPComparison(
                    symbol=symbol,
                    name=f"股票{symbol}",  # Mock name
                    vwap=round(vwap, 2),
                    price=round(price, 2),
                    deviation=round(deviation, 2),
                    signal=signal
                ))
        
        # Sort by deviation
        results.sort(key=lambda x: abs(x.deviation), reverse=True)
        
        return ApiResponse(code=200, message="success", data=results)
        
    except Exception as e:
        logger.error(f"Failed to get batch VWAP: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/vwap/intraday")
async def get_intraday_vwap(
    symbol: str,
    date: Optional[str] = Query(None, description="Trading date (YYYY-MM-DD), defaults to today")
):
    """Get intraday VWAP calculated from market open.
    
    Intraday VWAP is calculated cumulatively from the market open
    for the current trading day.
    
    Args:
        symbol: Stock symbol
        date: Trading date (defaults to today)
        
    Returns:
        VWAPResponse with intraday data.
    """
    try:
        # Mock intraday data (1-minute intervals)
        import random
        
        base_price = random.uniform(50, 2000)
        data = []
        
        # Generate data for trading hours (09:30 - 15:00, 240 minutes)
        for i in range(240):
            change = random.uniform(-0.001, 0.001)
            close = base_price * (1 + change)
            high = close * (1 + random.uniform(0, 0.002))
            low = close * (1 - random.uniform(0, 0.002))
            volume = random.uniform(100000, 1000000)
            
            data.append({
                'timestamp': int(datetime.now().timestamp()) - (240 - i) * 60,
                'open': round(base_price, 2),
                'high': round(high, 2),
                'low': round(low, 2),
                'close': round(close, 2),
                'volume': round(volume, 2)
            })
            
            base_price = close
        
        vwap_data = calculate_vwap(data)
        current = vwap_data[-1]
        
        history = [
            VWAPDataPoint(
                timestamp=d['timestamp'],
                datetime=datetime.fromtimestamp(d['timestamp'], timezone.utc).isoformat(),
                vwap=d['vwap'],
                close=d['close'],
                volume=d['volume'],
                typical_price=d['typical_price'],
                cumulative_typical_volume=d['cumulative_typical_volume'],
                cumulative_volume=d['cumulative_volume']
            )
            for d in vwap_data[::5]  # Sample every 5 points
        ]
        
        result = VWAPResponse(
            symbol=symbol,
            market="AShare",
            indicator="Intraday VWAP",
            period=len(data),
            current_value=round(current['vwap'], 2),
            current_price=round(current['close'], 2),
            price_vs_vwap=round(((current['close'] - current['vwap']) / current['vwap']) * 100, 2),
            trend="neutral",
            history=history,
            bands=None,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return ApiResponse(code=200, message="success", data=result)
        
    except Exception as e:
        logger.error(f"Failed to get intraday VWAP: {e}")
        raise HTTPException(status_code=500, detail=str(e))
