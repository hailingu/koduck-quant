"""Pydantic models for API requests and responses."""

from datetime import datetime, timezone
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field, ConfigDict


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper."""
    
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
    """Stock symbol information."""
    
    symbol: str = Field(..., description="Stock symbol/code")
    name: str = Field(..., description="Stock name")
    market: str = Field(..., description="Market type (AShare, USStock, etc.)")
    price: Optional[float] = Field(default=None, description="Current price")
    change_percent: Optional[float] = Field(
        default=None,
        description="Price change percentage"
    )
    volume: Optional[int] = Field(default=None, description="Trading volume")
    amount: Optional[float] = Field(default=None, description="Trading amount")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "002326",
                "name": "永太科技",
                "market": "AShare",
                "price": 9.55,
                "change_percent": 2.35,
                "volume": 125800,
                "amount": 1201500.0
            }
        }
    )


class PriceQuote(BaseModel):
    """Real-time price quote."""
    
    symbol: str = Field(..., description="Stock symbol")
    name: str = Field(..., description="Stock name")
    price: float = Field(..., description="Current price")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    prev_close: float = Field(..., description="Previous close price")
    volume: int = Field(..., description="Trading volume")
    amount: float = Field(..., description="Trading amount")
    change: float = Field(..., description="Price change")
    change_percent: float = Field(..., description="Price change percentage")
    bid_price: Optional[float] = Field(default=None, description="Best bid price")
    bid_volume: Optional[int] = Field(default=None, description="Best bid volume")
    ask_price: Optional[float] = Field(default=None, description="Best ask price")
    ask_volume: Optional[int] = Field(default=None, description="Best ask volume")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Quote timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "002326",
                "name": "永太科技",
                "price": 9.55,
                "open": 9.35,
                "high": 9.68,
                "low": 9.30,
                "prev_close": 9.33,
                "volume": 125800,
                "amount": 1201500.0,
                "change": 0.22,
                "change_percent": 2.36,
                "timestamp": "2026-02-28T14:30:00Z"
            }
        }
    )


class SearchRequest(BaseModel):
    """Stock search request parameters."""
    
    keyword: str = Field(..., min_length=1, description="Search keyword")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum results")


class BatchPriceRequest(BaseModel):
    """Batch price request."""
    
    symbols: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of stock symbols"
    )


class HotSymbolsRequest(BaseModel):
    """Hot symbols request parameters."""
    
    limit: int = Field(default=20, ge=1, le=50, description="Maximum results")


class HealthStatus(BaseModel):
    """Health check response."""
    
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "version": "1.0.0",
                "timestamp": "2026-02-28T14:30:00Z"
            }
        }
    )
