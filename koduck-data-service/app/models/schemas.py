"""Pydantic models used by the data service REST API.

Each model defines the JSON schema consumed or produced by endpoints.  Field
metadata (via ``Field``) supplies descriptions that appear in the generated
OpenAPI docs.

All docstrings follow the Google style guide and are written in English.
"""

from datetime import datetime, timezone
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field, ConfigDict


T = TypeVar("T")

DESCRIPTION_CURRENT_PRICE = "Current price"
DESCRIPTION_CHANGE_PERCENT = "Price change percentage"
DESCRIPTION_TRADING_VOLUME = "Trading volume"
DESCRIPTION_TRADING_AMOUNT = "Trading amount"
DESCRIPTION_OPENING_PRICE = "Opening price"
EXAMPLE_TIMESTAMP = "2026-02-28T14:30:00Z"


class ApiResponse(BaseModel, Generic[T]):
    """Standard wrapper used for every JSON response.

    Args:
        **kwargs: Passed through to :class:`pydantic.BaseModel`.

    Attributes:
        code (int): HTTP‑style response code (default ``200``).
        message (str): Short status message, e.g. ``"success"``.
        data (Optional[T]): Payload returned by the endpoint.
        timestamp (datetime): UTC timestamp when the response was generated.
    """
    
    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()}
    )
    
    code: int = Field(default=200, description="Response code")
    message: str = Field(default="success", description="Response message")
    data: Optional[T] = Field(default=None, description="Response data")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Response timestamp"
    )


class SymbolInfo(BaseModel):
    """Information about a single stock symbol.

    Attributes:
        symbol (str): Stock symbol or code.
        name (str): Company name or instrument name.
        market (str): Market identifier such as ``AShare`` or ``USStock``.
        price (Optional[float]): Current last trade price.
        change_percent (Optional[float]): Percentage change from previous close.
        volume (Optional[int]): Trading volume.
        amount (Optional[float]): Trading amount in currency units.
    """
    
    symbol: str = Field(..., description="Stock symbol/code")
    name: str = Field(..., description="Stock name")
    market: str = Field(..., description="Market type (AShare, USStock, etc.)")
    price: Optional[float] = Field(default=None, description=DESCRIPTION_CURRENT_PRICE)
    change_percent: Optional[float] = Field(
        default=None,
        description=DESCRIPTION_CHANGE_PERCENT
    )
    volume: Optional[int] = Field(default=None, description=DESCRIPTION_TRADING_VOLUME)
    amount: Optional[float] = Field(default=None, description=DESCRIPTION_TRADING_AMOUNT)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "002326",
                "name": "Yongtai Technology",
                "market": "AShare",
                "price": 9.55,
                "change_percent": 2.35,
                "volume": 125800,
                "amount": 1201500.0
            }
        }
    )


class PriceQuote(BaseModel):
    """Detailed real‑time price information for a single symbol.

    Attributes:
        symbol (str): Stock symbol.
        name (str): Name of the stock.
        price (float): Latest traded price.
        open (float): Opening price for the current session.
        high (float): Highest price during the session.
        low (float): Lowest price during the session.
        prev_close (float): Closing price from the previous session.
        volume (int): Number of shares traded.
        amount (float): Total traded amount.
        change (float): Absolute price change from previous close.
        change_percent (float): Percentage change from previous close.
        bid_price (Optional[float]): Best bid side price.
        bid_volume (Optional[int]): Quantity at the best bid.
        ask_price (Optional[float]): Best ask side price.
        ask_volume (Optional[int]): Quantity at the best ask.
        timestamp (datetime): UTC time when quote was fetched.
    """
    
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    price: float = Field(..., description=DESCRIPTION_CURRENT_PRICE)
    open: float = Field(..., description=DESCRIPTION_OPENING_PRICE)
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    prev_close: float = Field(..., description="Previous close price")
    volume: int = Field(..., description=DESCRIPTION_TRADING_VOLUME)
    amount: float = Field(..., description=DESCRIPTION_TRADING_AMOUNT)
    change: float = Field(..., description="Price change")
    change_percent: float = Field(..., description=DESCRIPTION_CHANGE_PERCENT)
    bid_price: Optional[float] = Field(default=None, description="Best bid price")
    bid_volume: Optional[int] = Field(default=None, description="Best bid volume")
    ask_price: Optional[float] = Field(default=None, description="Best ask price")
    ask_volume: Optional[int] = Field(default=None, description="Best ask volume")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Quote timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "002326",
                "name": "Yongtai Technology",
                "price": 9.55,
                "open": 9.35,
                "high": 9.68,
                "low": 9.30,
                "prev_close": 9.33,
                "volume": 125800,
                "amount": 1201500.0,
                "change": 0.22,
                "change_percent": 2.36,
                "timestamp": EXAMPLE_TIMESTAMP
            }
        }
    )


class SearchRequest(BaseModel):
    """Parameters for a symbol search endpoint.

    Attributes:
        keyword (str): Text to search for in symbol or name.
        limit (int): Maximum number of results to return.
    """
    
    keyword: str = Field(..., min_length=1, description="Search keyword")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum results")


class BatchPriceRequest(BaseModel):
    """Payload used when requesting quotes for multiple symbols.

    Attributes:
        symbols (List[str]): List of stock symbols to query (1–50 items).
    """
    
    symbols: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of stock symbols"
    )


class HealthStatus(BaseModel):
    """Simple status report returned by the health endpoint.

    Attributes:
        status (str): ``"ok"`` when service is healthy.
        version (str): Application version string.
        timestamp (datetime): Time the status was generated in UTC.
    """
    
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "version": "1.0.0",
                "timestamp": EXAMPLE_TIMESTAMP
            }
        }
    )


class KlineData(BaseModel):
    """Represents a single candlestick (K‑line) data point.

    Attributes:
        timestamp (int): Unix timestamp (seconds).
        open (float): Opening price of the interval.
        high (float): Highest price of the interval.
        low (float): Lowest price of the interval.
        close (float): Closing price of the interval.
        volume (Optional[int]): Trading volume during interval.
        amount (Optional[float]): Trading amount during interval.
    """
    
    timestamp: int = Field(..., description="Unix timestamp")
    open: float = Field(..., description=DESCRIPTION_OPENING_PRICE)
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    volume: Optional[int] = Field(default=None, description=DESCRIPTION_TRADING_VOLUME)
    amount: Optional[float] = Field(default=None, description=DESCRIPTION_TRADING_AMOUNT)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "timestamp": 1704067200,
                "open": 9.50,
                "high": 9.80,
                "low": 9.40,
                "close": 9.65,
                "volume": 125800,
                "amount": 1201500.0
            }
        }
    )


class KlineRequest(BaseModel):
    """Parameters for requesting historical K‑line data.

    Attributes:
        symbol (str): Stock symbol to query.
        timeframe (str): Period string such as ``"1D"`` or ``"5m"``.
        limit (int): Maximum number of points to return.
        before_time (Optional[int]): Fetch data before this Unix timestamp.
    """
    
    symbol: str = Field(..., description="Stock symbol")
    timeframe: str = Field(default="1D", description="Time period: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M")
    limit: int = Field(default=300, ge=1, le=1000, description="Number of data points")
    before_time: Optional[int] = Field(default=None, description="Get data before this Unix timestamp")


class StockValuation(BaseModel):
    """Stock valuation metrics including PE, PB, market cap and turnover rate.
    
    Attributes:
        symbol (str): Stock symbol.
        name (str): Stock name.
        pe_ttm (Optional[float]): PE ratio based on TTM earnings.
        pb (Optional[float]): Price-to-Book ratio.
        ps_ttm (Optional[float]): Price-to-Sales ratio based on TTM.
        market_cap (Optional[float]): Total market cap in 100 million CNY.
        float_market_cap (Optional[float]): Float market cap in 100 million CNY.
        total_shares (Optional[float]): Total shares in 100 million.
        float_shares (Optional[float]): Float shares in 100 million.
        float_ratio (Optional[float]): Float share ratio percentage.
        turnover_rate (Optional[float]): Turnover rate percentage.
    """
    
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    pe_ttm: Optional[float] = Field(default=None, description="PE ratio (TTM)")
    pb: Optional[float] = Field(default=None, description="Price-to-Book ratio")
    ps_ttm: Optional[float] = Field(default=None, description="Price-to-Sales ratio (TTM)")
    market_cap: Optional[float] = Field(default=None, description="Total market cap (100M CNY)")
    float_market_cap: Optional[float] = Field(default=None, description="Float market cap (100M CNY)")
    total_shares: Optional[float] = Field(default=None, description="Total shares (100M)")
    float_shares: Optional[float] = Field(default=None, description="Float shares (100M)")
    float_ratio: Optional[float] = Field(default=None, description="Float ratio (%)")
    turnover_rate: Optional[float] = Field(default=None, description="Turnover rate (%)")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "002326",
                "name": "Yongtai Technology",
                "pe_ttm": 25.68,
                "pb": 2.35,
                "ps_ttm": 3.12,
                "market_cap": 85.6,
                "float_market_cap": 42.3,
                "total_shares": 5.2,
                "float_shares": 2.8,
                "float_ratio": 53.85,
                "turnover_rate": 3.56
            }
        }
    )


class MarketIndex(BaseModel):
    """Data structure for a market index quote.

    Attributes:
        symbol (str): Index code.
        name (str): Index name (e.g. Shanghai Composite).
        price (Optional[float]): Current index price.
        change (Optional[float]): Absolute change from previous close.
        change_percent (Optional[float]): Percentage change.
        open (Optional[float]): Opening value of the index.
        high (Optional[float]): Highest value recorded.
        low (Optional[float]): Lowest value recorded.
        prev_close (Optional[float]): Previous closing value.
        volume (Optional[int]): Volume if available.
        amount (Optional[float]): Amount traded if applicable.
        timestamp (datetime): Time of the data point UTC.
    """
    
    symbol: str = Field(..., description="Index symbol/code")
    name: str = Field(..., description="Index name")
    price: Optional[float] = Field(default=None, description=DESCRIPTION_CURRENT_PRICE)
    change: Optional[float] = Field(default=None, description="Price change")
    change_percent: Optional[float] = Field(default=None, description=DESCRIPTION_CHANGE_PERCENT)
    open: Optional[float] = Field(default=None, description=DESCRIPTION_OPENING_PRICE)
    high: Optional[float] = Field(default=None, description="High price")
    low: Optional[float] = Field(default=None, description="Low price")
    prev_close: Optional[float] = Field(default=None, description="Previous close price")
    volume: Optional[int] = Field(default=None, description=DESCRIPTION_TRADING_VOLUME)
    amount: Optional[float] = Field(default=None, description=DESCRIPTION_TRADING_AMOUNT)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Data timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "000001",
                "name": "Shanghai Composite Index",
                "price": 3250.68,
                "change": 25.35,
                "change_percent": 0.78,
                "open": 3225.33,
                "high": 3260.12,
                "low": 3220.45,
                "prev_close": 3225.33,
                "volume": 325800000,
                "amount": 458900000000.0,
                "timestamp": EXAMPLE_TIMESTAMP
            }
        }
    )
