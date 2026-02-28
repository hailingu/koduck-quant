"""AKShare client for A-share market data."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

import akshare as ak
import pandas as pd

from app.models.schemas import PriceQuote, SymbolInfo

logger = logging.getLogger(__name__)


class AKShareClient:
    """Client for fetching A-share data using AKShare."""
    
    def __init__(self):
        """Initialize the client."""
        self._spot_cache: Optional[pd.DataFrame] = None
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 30  # Cache TTL for spot data
    
    def _get_spot_data(self) -> pd.DataFrame:
        """Get real-time spot data with caching."""
        now = datetime.now(timezone.utc)
        
        # Check if cache is valid
        if (
            self._spot_cache is not None
            and self._cache_timestamp is not None
            and (now - self._cache_timestamp).seconds < self._cache_ttl_seconds
        ):
            return self._spot_cache
        
        try:
            # Fetch fresh data from AKShare
            df = ak.stock_zh_a_spot_em()
            self._spot_cache = df
            self._cache_timestamp = now
            logger.debug(f"Fetched {len(df)} stocks from AKShare")
            return df
        except Exception as e:
            logger.error(f"Failed to fetch spot data: {e}")
            # Return cached data if available, even if expired
            if self._spot_cache is not None:
                return self._spot_cache
            raise
    
    def search_symbols(self, keyword: str, limit: int = 20) -> List[SymbolInfo]:
        """Search stocks by keyword.
        
        Args:
            keyword: Search keyword (name or symbol)
            limit: Maximum number of results
            
        Returns:
            List of matching symbols
        """
        try:
            df = self._get_spot_data()
            
            # Search by name or symbol (case-insensitive for name)
            mask = (
                df['名称'].str.contains(keyword, case=False, na=False) |
                df['代码'].str.contains(keyword, na=False)
            )
            result = df[mask].head(limit)
            
            symbols = []
            for _, row in result.iterrows():
                try:
                    symbol = SymbolInfo(
                        symbol=str(row['代码']),
                        name=str(row['名称']),
                        market="AShare",
                        price=self._safe_float(row.get('最新价')),
                        change_percent=self._safe_float(row.get('涨跌幅')),
                        volume=self._safe_int(row.get('成交量')),
                        amount=self._safe_float(row.get('成交额'))
                    )
                    symbols.append(symbol)
                except Exception as e:
                    logger.warning(f"Failed to parse symbol row: {e}")
                    continue
            
            logger.info(f"Search '{keyword}' returned {len(symbols)} results")
            return symbols
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def get_realtime_price(self, symbol: str) -> Optional[PriceQuote]:
        """Get real-time price for a single stock.
        
        Args:
            symbol: Stock symbol (e.g., '002326')
            
        Returns:
            Price quote or None if not found
        """
        try:
            df = self._get_spot_data()
            stock = df[df['代码'] == symbol]
            
            if stock.empty:
                logger.warning(f"Symbol not found: {symbol}")
                return None
            
            row = stock.iloc[0]
            
            return PriceQuote(
                symbol=symbol,
                name=str(row['名称']),
                price=self._safe_float(row.get('最新价'), 0.0),
                open=self._safe_float(row.get('今开'), 0.0),
                high=self._safe_float(row.get('最高'), 0.0),
                low=self._safe_float(row.get('最低'), 0.0),
                prev_close=self._safe_float(row.get('昨收'), 0.0),
                volume=self._safe_int(row.get('成交量'), 0),
                amount=self._safe_float(row.get('成交额'), 0.0),
                change=self._safe_float(row.get('涨跌额'), 0.0),
                change_percent=self._safe_float(row.get('涨跌幅'), 0.0),
                bid_price=self._safe_float(row.get('买一')),
                bid_volume=self._safe_int(row.get('买一量')),
                ask_price=self._safe_float(row.get('卖一')),
                ask_volume=self._safe_int(row.get('卖一量')),
                timestamp=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            logger.error(f"Failed to get price for {symbol}: {e}")
            return None
    
    def get_batch_prices(self, symbols: List[str]) -> List[PriceQuote]:
        """Get real-time prices for multiple stocks.
        
        Args:
            symbols: List of stock symbols
            
        Returns:
            List of price quotes
        """
        try:
            df = self._get_spot_data()
            stocks = df[df['代码'].isin(symbols)]
            
            quotes = []
            for _, row in stocks.iterrows():
                try:
                    quote = PriceQuote(
                        symbol=str(row['代码']),
                        name=str(row['名称']),
                        price=self._safe_float(row.get('最新价'), 0.0),
                        open=self._safe_float(row.get('今开'), 0.0),
                        high=self._safe_float(row.get('最高'), 0.0),
                        low=self._safe_float(row.get('最低'), 0.0),
                        prev_close=self._safe_float(row.get('昨收'), 0.0),
                        volume=self._safe_int(row.get('成交量'), 0),
                        amount=self._safe_float(row.get('成交额'), 0.0),
                        change=self._safe_float(row.get('涨跌额'), 0.0),
                        change_percent=self._safe_float(row.get('涨跌幅'), 0.0),
                        timestamp=datetime.now(timezone.utc)
                    )
                    quotes.append(quote)
                except Exception as e:
                    logger.warning(f"Failed to parse price row: {e}")
                    continue
            
            logger.info(f"Batch price query returned {len(quotes)} results")
            return quotes
            
        except Exception as e:
            logger.error(f"Batch price query failed: {e}")
            return []
    
    def get_hot_symbols(self, limit: int = 20) -> List[SymbolInfo]:
        """Get hot stocks sorted by trading amount.
        
        Args:
            limit: Number of hot stocks to return
            
        Returns:
            List of hot symbols
        """
        try:
            df = self._get_spot_data()
            
            # Sort by trading amount (成交额) descending
            df = df.nlargest(limit, '成交额')
            
            symbols = []
            for _, row in df.iterrows():
                try:
                    symbol = SymbolInfo(
                        symbol=str(row['代码']),
                        name=str(row['名称']),
                        market="AShare",
                        price=self._safe_float(row.get('最新价')),
                        change_percent=self._safe_float(row.get('涨跌幅')),
                        volume=self._safe_int(row.get('成交量')),
                        amount=self._safe_float(row.get('成交额'))
                    )
                    symbols.append(symbol)
                except Exception as e:
                    logger.warning(f"Failed to parse hot symbol row: {e}")
                    continue
            
            logger.info(f"Hot symbols query returned {len(symbols)} results")
            return symbols
            
        except Exception as e:
            logger.error(f"Hot symbols query failed: {e}")
            return []
    
    def get_kline_data(self, symbol: str, period: str = "daily", 
                       start_date: Optional[str] = None,
                       end_date: Optional[str] = None,
                       limit: int = 300) -> List[dict]:
        """Get K-line historical data for a stock.
        
        Args:
            symbol: Stock symbol (e.g., '002326')
            period: Data period - 'daily', 'weekly', 'monthly'
            start_date: Start date (YYYYMMDD), optional
            end_date: End date (YYYYMMDD), optional
            limit: Maximum number of records
            
        Returns:
            List of K-line data points
        """
        try:
            # Map timeframe to AKShare period
            period_map = {
                "1D": "daily",
                "1W": "weekly", 
                "1M": "monthly"
            }
            ak_period = period_map.get(period, period)
            
            # Use AKShare to fetch historical data
            df = ak.stock_zh_a_hist(symbol=symbol, period=ak_period, 
                                    start_date=start_date, end_date=end_date)
            
            if df.empty:
                return []
            
            # Limit results
            df = df.tail(limit)
            
            klines = []
            for _, row in df.iterrows():
                try:
                    # Convert date string to timestamp
                    date_str = str(row['日期'])
                    timestamp = int(pd.Timestamp(date_str).timestamp())
                    
                    kline = {
                        "timestamp": timestamp,
                        "open": self._safe_float(row.get('开盘'), 0.0),
                        "high": self._safe_float(row.get('最高'), 0.0),
                        "low": self._safe_float(row.get('最低'), 0.0),
                        "close": self._safe_float(row.get('收盘'), 0.0),
                        "volume": self._safe_int(row.get('成交量')),
                        "amount": self._safe_float(row.get('成交额'))
                    }
                    klines.append(kline)
                except Exception as e:
                    logger.warning(f"Failed to parse kline row: {e}")
                    continue
            
            logger.info(f"Kline query for {symbol} returned {len(klines)} results")
            return klines
            
        except Exception as e:
            logger.error(f"Kline query failed for {symbol}: {e}")
            return []
    
    @staticmethod
    def _safe_float(value, default: Optional[float] = None) -> Optional[float]:
        """Safely convert value to float."""
        if value is None or pd.isna(value):
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def _safe_int(value, default: Optional[int] = None) -> Optional[int]:
        """Safely convert value to int."""
        if value is None or pd.isna(value):
            return default
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return default


# Global client instance
akshare_client = AKShareClient()
