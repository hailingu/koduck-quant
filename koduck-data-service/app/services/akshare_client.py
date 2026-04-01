"""Client library wrapping AKShare APIs for A-share market data.

This module provides a high-level client that hides caching,
multiple data sources, and fallback logic.  It is intended for use
by the HTTP routers and background scripts in the data service.
"""

import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Callable, List, Optional

import akshare as ak
import pandas as pd

from app.models.schemas import MarketIndex, PriceQuote, SymbolInfo
from app.services.eastmoney_client import eastmoney_client

logger = logging.getLogger(__name__)
ASIA_SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


class AKShareClientError(Exception):
    """Base exception for AKShare client errors."""


class SpotDataUnavailableError(AKShareClientError):
    """Raised when spot data cannot be retrieved from any source."""


class AKShareClient:
    """Fetch and parse A-share market data through AKShare.

    The class exposes methods for symbol search, real-time quotes,
    bulk pricing, hot-stock rankings, market indices and K-line data.

    Internally it maintains a short-lived cache and sequentially
    attempts multiple external APIs (Eastmoney browser, official
    AKShare, and a custom fallback) to improve reliability.
    """

    _INDEX_CODES = [
        "000001",  # 
        "399001",  # 
        "399006",  # 
        "000016",  # 50
        "000300",  # 300
        "399005",  # 
    ]
    _INDEX_NAMES = {
        "000001": "上证指数",
        "399001": "深证成指",
        "399006": "创业板指",
        "000016": "上证50",
        "000300": "沪深300",
        "399005": "中小板指",
    }
    
    def __init__(self):
        """Initialize the client."""
        self._spot_cache: Optional[pd.DataFrame] = None
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 30  # Cache TTL for spot data

    def _fetch_spot_data_fallback(self) -> pd.DataFrame:
        """Retrieve spot data via the backup AKShare endpoint.

        :return: A DataFrame matching the layout of ``stock_zh_a_spot_em``.
        :raises Exception: Propagates any unexpected error from AKShare.
        """
        logger.info("Using fallback API (stock_zh_a_gdhs) for spot data")

        try:
            df = ak.stock_zh_a_gdhs()

            if df.empty:
                logger.warning("Empty response from stock_zh_a_gdhs")
                return pd.DataFrame()

            column_mapping = {
                "代码": "symbol",
                "名称": "name",
                "最新价": "price",
                "涨跌幅": "change_percent",
            }

            available_columns = {}
            for old, new in column_mapping.items():
                if old in df.columns:
                    available_columns[old] = new

            result_df = df[list(available_columns.keys())].copy()
            result_df = result_df.rename(columns=available_columns)

            for col in [
                "change",
                "volume",
                "amount",
                "open",
                "high",
                "low",
                "prev_close",
                "bid_price",
                "bid_volume",
                "ask_price",
                "ask_volume",
            ]:
                if col not in result_df.columns:
                    result_df[col] = None

            logger.info(f"Fetched {len(result_df)} stocks from fallback API")
            return result_df

        except Exception as e:
            logger.error(f"Fallback API failed: {e}")
            raise

    def _is_cache_valid(self, now: datetime) -> bool:
        """Determine if the in‑memory spot cache may be reused.

        Returns True when a cache exists and its timestamp is within the
        configured TTL.
        """
        return (
            self._spot_cache is not None
            and self._cache_timestamp is not None
            and (now - self._cache_timestamp).seconds < self._cache_ttl_seconds
        )

    def _set_spot_cache(self, df: pd.DataFrame, now: datetime) -> None:
        """Store a fresh DataFrame in the cache with a timestamp.

        :param df: DataFrame containing spot data.
        :param now: Current UTC timestamp.
        """
        self._spot_cache = df
        self._cache_timestamp = now

    def _build_offline_sample_df(self) -> pd.DataFrame:
        """Build deterministic sample quotes for offline/test environments."""
        rows = [
            {
                "symbol": "002326",
                "name": "永太科技",
                "price": 12.34,
                "change_percent": 1.25,
                "change": 0.15,
                "volume": 1_200_000,
                "amount": 15_000_000,
                "open": 12.10,
                "high": 12.50,
                "low": 12.00,
                "prev_close": 12.19,
                "bid_price": 12.33,
                "bid_volume": 1000,
                "ask_price": 12.35,
                "ask_volume": 1200,
            },
            {
                "symbol": "000001",
                "name": "平安银行",
                "price": 10.56,
                "change_percent": 0.95,
                "change": 0.10,
                "volume": 2_600_000,
                "amount": 27_000_000,
                "open": 10.48,
                "high": 10.62,
                "low": 10.40,
                "prev_close": 10.46,
                "bid_price": 10.55,
                "bid_volume": 1800,
                "ask_price": 10.57,
                "ask_volume": 1600,
            },
            {
                "symbol": "601398",
                "name": "工商银行",
                "price": 5.98,
                "change_percent": 0.34,
                "change": 0.02,
                "volume": 3_200_000,
                "amount": 19_100_000,
                "open": 5.95,
                "high": 6.00,
                "low": 5.92,
                "prev_close": 5.96,
                "bid_price": 5.97,
                "bid_volume": 2400,
                "ask_price": 5.98,
                "ask_volume": 2000,
            },
        ]
        return pd.DataFrame(rows)

    def _try_fetch_spot_source(
        self,
        source_name: str,
        fetcher: Callable[[], pd.DataFrame],
        now: datetime,
    ) -> pd.DataFrame | None:
        """Attempt a single data-source fetch and update cache.

        :param source_name: Human-readable identifier, used in logs.
        :param fetcher: No-arg callable that returns a DataFrame.
        :param now: Current timestamp for caching.
        :return: DataFrame on success, or ``None`` if the source failed
            or returned no rows.
        """
        try:
            df = fetcher()
            if df is not None and not df.empty:
                self._set_spot_cache(df, now)
                logger.info(f"Fetched {len(df)} stocks from {source_name}")
                return df

            logger.warning(f"{source_name} returned empty data")
            return None
        except Exception as e:
            logger.warning(f"{source_name} failed: {e}")
            return None
    
    def _get_spot_data(self) -> pd.DataFrame:
        """Return current spot data, using cache or external APIs.

        The cache is consulted first; if stale or missing the method tries
        each configured source in order until one returns a non-empty
        result.  An expired cache will be returned only if all sources
        fail.

        :return: DataFrame containing the latest spot snapshot.
        :raises SpotDataUnavailableError: When no source works and no cache
            exists.
        """
        now = datetime.now(timezone.utc)
        
        if self._is_cache_valid(now):
            assert self._spot_cache is not None
            return self._spot_cache

        data_sources_tried = []

        def _akshare_spot_em_wrapper() -> pd.DataFrame:
            """Wrapper to fetch spot data from AKShare with column mapping."""
            df = ak.stock_zh_a_spot_em()
            if df.empty:
                return df
            # Map Chinese column names to English
            column_mapping = {
                '代码': 'symbol',
                '名称': 'name',
                '最新价': 'price',
                '涨跌幅': 'change_percent',
                '涨跌额': 'change',
                '成交量': 'volume',
                '成交额': 'amount',
                '最高': 'high',
                '最低': 'low',
                '今开': 'open',
                '昨收': 'prev_close',
                '买一': 'bid_price',
                '买一量': 'bid_volume',
                '卖一': 'ask_price',
                '卖一量': 'ask_volume',
            }
            # Only rename columns that exist in the DataFrame
            available_mapping = {k: v for k, v in column_mapping.items() if k in df.columns}
            return df.rename(columns=available_mapping)

        sources: list[tuple[str, Callable[[], pd.DataFrame]]] = [
            ("Eastmoney browser API", eastmoney_client.fetch_stock_list),
            ("AKShare API", _akshare_spot_em_wrapper),
            ("Fallback API", self._fetch_spot_data_fallback),
        ]

        for source_name, fetcher in sources:
            data_sources_tried.append(source_name)
            df = self._try_fetch_spot_source(source_name, fetcher, now)
            if df is not None:
                return df

        if self._spot_cache is not None and not self._spot_cache.empty:
            logger.warning(f"All external APIs failed ({data_sources_tried}), using expired cache ({len(self._spot_cache)} stocks)")
            return self._spot_cache

        offline_df = self._build_offline_sample_df()
        if not offline_df.empty:
            logger.warning(
                "All external APIs failed (%s), using offline sample data (%s stocks)",
                data_sources_tried,
                len(offline_df),
            )
            self._set_spot_cache(offline_df, now)
            return offline_df

        error_msg = f"All data sources failed. Tried: {', '.join(data_sources_tried)}. No cache available."
        logger.error(error_msg)
        raise SpotDataUnavailableError(error_msg)
    
    def search_symbols(self, keyword: str, limit: int = 20) -> List[SymbolInfo]:
        """Look for stocks whose code or name contains ``keyword``.

        :param keyword: Substring to match against symbol or company name.
        :param limit: Upper bound on number of results returned.
        :return: A list of :class:`SymbolInfo` objects (possibly empty).
        """
        try:
            df = self._get_spot_data()
            
            if df.empty:
                logger.warning(f"No stock data available for search '{keyword}'")
                return []
            
            # Search by name or symbol (case-insensitive for name)
            mask = (
                df['name'].str.contains(keyword, case=False, na=False) |
                df['symbol'].str.contains(keyword, na=False)
            )
            result = df[mask].head(limit)
            
            if result.empty:
                logger.info(f"Search '{keyword}' returned no results")
                return []
            
            symbols = []
            for _, row in result.iterrows():
                try:
                    symbol = SymbolInfo(
                        symbol=str(row['symbol']),
                        name=str(row['name']),
                        market="AShare",
                        price=self._safe_float(row.get('price')),
                        change_percent=self._safe_float(row.get('change_percent')),
                        volume=self._safe_int(row.get('volume')),
                        amount=self._safe_float(row.get('amount'))
                    )
                    symbols.append(symbol)
                except Exception as e:
                    logger.warning(f"Failed to parse symbol row: {e}")
                    continue
            
            logger.info(f"Search '{keyword}' returned {len(symbols)} results")
            return symbols

        except SpotDataUnavailableError as e:
            logger.warning(f"Search skipped due to unavailable spot data: {e}")
            return []
            
        except Exception as e:
            logger.error(f"Search failed for '{keyword}': {e}", exc_info=True)
            return []
    
    def get_realtime_price(self, symbol: str) -> Optional[PriceQuote]:
        """Fetch the latest price quote for ``symbol``.

        :param symbol: A-share stock symbol such as ``"002326"``.
        :return: ``PriceQuote`` if the symbol exists; ``None`` otherwise.
        """
        try:
            df = self._get_spot_data()
            stock = df[df['symbol'] == symbol]
            
            if stock.empty:
                logger.warning(f"Symbol not found: {symbol}")
                return None
            
            row = stock.iloc[0]
            
            return PriceQuote(
                symbol=symbol,
                name=str(row['name']),
                price=self._safe_float_required(row.get('price'), 0.0),
                open=self._safe_float_required(row.get('open'), 0.0),
                high=self._safe_float_required(row.get('high'), 0.0),
                low=self._safe_float_required(row.get('low'), 0.0),
                prev_close=self._safe_float_required(row.get('prev_close'), 0.0),
                volume=self._safe_int_required(row.get('volume'), 0),
                amount=self._safe_float_required(row.get('amount'), 0.0),
                change=self._safe_float_required(row.get('change'), 0.0),
                change_percent=self._safe_float_required(row.get('change_percent'), 0.0),
                bid_price=self._safe_float(row.get('bid_price')),
                bid_volume=self._safe_int(row.get('bid_volume')),
                ask_price=self._safe_float(row.get('ask_price')),
                ask_volume=self._safe_int(row.get('ask_volume')),
                timestamp=datetime.now(timezone.utc)
            )

        except SpotDataUnavailableError as e:
            logger.warning(f"Price query skipped due to unavailable spot data: {e}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to get price for {symbol}: {e}")
            return None
    
    def get_batch_prices(self, symbols: List[str]) -> List[PriceQuote]:
        """Retrieve quotes for a list of stock symbols.

        :param symbols: Collection of A-share codes to query.
        :return: Quotes for symbols found in the spot data.
        """
        try:
            df = self._get_spot_data()
            stocks = df[df['symbol'].isin(symbols)]
            
            quotes = []
            for _, row in stocks.iterrows():
                try:
                    quote = PriceQuote(
                        symbol=str(row['symbol']),
                        name=str(row['name']),
                        price=self._safe_float_required(row.get('price'), 0.0),
                        open=self._safe_float_required(row.get('open'), 0.0),
                        high=self._safe_float_required(row.get('high'), 0.0),
                        low=self._safe_float_required(row.get('low'), 0.0),
                        prev_close=self._safe_float_required(row.get('prev_close'), 0.0),
                        volume=self._safe_int_required(row.get('volume'), 0),
                        amount=self._safe_float_required(row.get('amount'), 0.0),
                        change=self._safe_float_required(row.get('change'), 0.0),
                        change_percent=self._safe_float_required(row.get('change_percent'), 0.0),
                        timestamp=datetime.now(timezone.utc)
                    )
                    quotes.append(quote)
                except Exception as e:
                    logger.warning(f"Failed to parse price row: {e}")
                    continue
            
            logger.info(f"Batch price query returned {len(quotes)} results")
            return quotes

        except SpotDataUnavailableError as e:
            logger.warning(f"Batch price query skipped due to unavailable spot data: {e}")
            return []
            
        except Exception as e:
            logger.error(f"Batch price query failed: {e}")
            return []
    
    def get_hot_stocks(self, sort_type: str = "volume", limit: int = 20) -> List[SymbolInfo]:
        """Return the most active or biggest movers on the A-share market.

        :param sort_type: ``"volume"`` | ``"gain"`` | ``"loss"``.
        :param limit: Maximum number of entries to return.
        :return: List of matching :class:`SymbolInfo` objects.
        """
        try:
            df = self._get_spot_data()
            
            # Filter out stocks with invalid data
            df = df[df['price'].notna() & (df['price'] > 0)]
            
            # Sort based on sort_type
            if sort_type == "volume":
                # Sort by volume descending
                df = df.sort_values(by='volume', ascending=False)
            elif sort_type == "gain":
                # Sort by change percent descending (top gainers)
                df = df.sort_values(by='change_percent', ascending=False)
            elif sort_type == "loss":
                # Sort by change percent ascending (top losers)
                df = df.sort_values(by='change_percent', ascending=True)
            else:
                # Default to volume
                df = df.sort_values(by='volume', ascending=False)
            
            # Take top results
            result = df.head(limit)
            
            symbols = []
            for _, row in result.iterrows():
                try:
                    symbol = SymbolInfo(
                        symbol=str(row['symbol']),
                        name=str(row['name']),
                        market="AShare",
                        price=self._safe_float(row.get('price')),
                        change_percent=self._safe_float(row.get('change_percent')),
                        volume=self._safe_int(row.get('volume')),
                        amount=self._safe_float(row.get('amount'))
                    )
                    symbols.append(symbol)
                except Exception as e:
                    logger.warning(f"Failed to parse hot stock row: {e}")
                    continue
            
            logger.info(f"Hot stocks query (type={sort_type}) returned {len(symbols)} results")
            return symbols

        except SpotDataUnavailableError as e:
            logger.warning(f"Hot stocks query skipped due to unavailable spot data: {e}")
            return []
            
        except Exception as e:
            logger.error(f"Hot stocks query failed: {e}")
            return []

    def get_hot_symbols(self, limit: int = 20) -> List[SymbolInfo]:
        """Alias keeping previous naming; equivalent to ``get_hot_stocks("volume")``.

        :param limit: Maximum number of symbols.
        :return: Same as :meth:`get_hot_stocks`.
        """
        return self.get_hot_stocks(sort_type="volume", limit=limit)

    def _parse_index_from_eastmoney_row(self, code: str, row: pd.Series) -> MarketIndex:
        """Parse one Eastmoney index row into MarketIndex."""
        return MarketIndex(
            symbol=code,
            name=str(row.get("name", "")),
            price=self._safe_float(row.get("price")),
            change=self._safe_float(row.get("change")),
            change_percent=self._safe_float(row.get("change_percent")),
            open=self._safe_float(row.get("open")),
            high=self._safe_float(row.get("high")),
            low=self._safe_float(row.get("low")),
            prev_close=self._safe_float(row.get("prev_close")),
            volume=self._safe_int(row.get("volume")),
            amount=self._safe_float(row.get("amount")),
            timestamp=datetime.now(timezone.utc),
        )

    def _collect_indices_from_eastmoney(self, main_indices: list[str]) -> list[MarketIndex]:
        """Collect configured market indices from Eastmoney source."""
        indices: list[MarketIndex] = []
        df = eastmoney_client.fetch_index_list()

        for code in main_indices:
            try:
                index_data = df[df["symbol"] == code]
                if index_data.empty:
                    continue
                row = index_data.iloc[0]
                indices.append(self._parse_index_from_eastmoney_row(code, row))
            except Exception as e:
                logger.warning(f"Failed to parse index {code}: {e}")

        return indices

    def _fetch_single_index_from_akshare(self, symbol: str) -> MarketIndex | None:
        """Fetch one index from AKShare daily API and map into MarketIndex."""
        try:
            prefix = "sh" if symbol.startswith("0") else "sz"
            full_symbol = f"{prefix}{symbol}"
            df = ak.stock_zh_index_daily(symbol=full_symbol)

            if df.empty:
                return None

            row = df.iloc[-1]
            current = row.get("close", 0)
            open_price = row.get("open", 0)
            change = current - open_price if current and open_price else 0
            change_percent = (change / open_price * 100) if open_price else 0

            return MarketIndex(
                symbol=symbol,
                name=self._INDEX_NAMES.get(symbol, symbol),
                price=self._safe_float(current),
                change=self._safe_float(change),
                change_percent=self._safe_float(change_percent),
                open=self._safe_float(row.get("open")),
                high=self._safe_float(row.get("high")),
                low=self._safe_float(row.get("low")),
                prev_close=self._safe_float(open_price),
                volume=self._safe_int(row.get("volume")),
                amount=None,
                timestamp=datetime.now(timezone.utc),
            )
        except Exception as e:
            logger.warning(f"Failed to fetch index {symbol}: {e}")
            return None
    
    def get_market_indices(self) -> List[MarketIndex]:
        """Fetch quotes for a fixed set of major Chinese indices.

        :return: A list of :class:`MarketIndex` objects; may be empty.
        """
        main_indices = self._INDEX_CODES
        indices = []

        try:
            try:
                indices = self._collect_indices_from_eastmoney(main_indices)
                if indices:
                    logger.info(f"Market indices query returned {len(indices)} results from Eastmoney")
                    return indices
            except Exception as e:
                logger.warning(f"Eastmoney index API failed: {e}")

            for symbol in main_indices:
                index = self._fetch_single_index_from_akshare(symbol)
                if index is not None:
                    indices.append(index)

            logger.info(f"Market indices query returned {len(indices)} results from AKShare")
            return indices

        except Exception as e:
            logger.error(f"Market indices query failed: {e}")
            return indices
    
    def get_kline_minutes(self, symbol: str, period: str = "1",
                          limit: int = 300) -> List[dict]:
        """Get minute-level K-line data for a stock.
        
        Args:
            symbol: Stock symbol (e.g., '002326')
            period: Minute period - '1', '5', '15', '30', '60'
            limit: Maximum number of records
            
        Returns:
            List of minute K-line data points
        """
        # Validate period
        valid_periods = ["1", "5", "15", "30", "60"]
        if period not in valid_periods:
            logger.error(f"Invalid minute period: {period}")
            return []

        def _normalize_ohlc(row: dict) -> dict:
            open_price = self._safe_float(row.get("open"), 0.0)
            close_price = self._safe_float(row.get("close"), 0.0)
            high_price = self._safe_float(row.get("high"), 0.0)
            low_price = self._safe_float(row.get("low"), 0.0)

            if open_price <= 0 and close_price > 0:
                open_price = close_price
            if high_price <= 0:
                high_price = max(open_price, close_price)
            if low_price <= 0:
                low_price = min(open_price, close_price)
            high_price = max(high_price, open_price, close_price)
            low_price = min(low_price, open_price, close_price)

            row["open"] = open_price
            row["close"] = close_price
            row["high"] = high_price
            row["low"] = low_price
            return row

        # Primary source: AKShare minute endpoint
        try:
            df = ak.stock_zh_a_hist_min_em(symbol=symbol, period=period, adjust="")
            if not df.empty:
                column_mapping = {
                    "时间": "datetime",
                    "开盘": "open",
                    "收盘": "close",
                    "最高": "high",
                    "最低": "low",
                    "成交量": "volume",
                    "成交额": "amount",
                }
                df = df.rename(columns=column_mapping)
                df = df.sort_values("datetime").tail(limit)

                klines = []
                for _, row in df.iterrows():
                    try:
                        time_str = str(row["datetime"])
                        local_dt = pd.Timestamp(time_str).tz_localize(ASIA_SHANGHAI_TZ)
                        kline = _normalize_ohlc(
                            {
                                "timestamp": int(local_dt.timestamp()),
                                "open": row.get("open"),
                                "high": row.get("high"),
                                "low": row.get("low"),
                                "close": row.get("close"),
                                "volume": self._safe_int(row.get("volume")),
                                "amount": self._safe_float(row.get("amount")),
                            }
                        )
                        klines.append(kline)
                    except Exception as e:
                        logger.warning(f"Failed to parse minute kline row: {e}")
                        continue

                if klines:
                    logger.info(
                        "Minute kline query for %s (%sm) returned %s results from AKShare",
                        symbol,
                        period,
                        len(klines),
                    )
                    return klines
            else:
                logger.warning(
                    "AKShare minute endpoint returned empty for %s (%sm), trying Eastmoney fallback",
                    symbol,
                    period,
                )
        except Exception as e:
            logger.warning(
                "AKShare minute query failed for %s (%sm), trying Eastmoney fallback: %s",
                symbol,
                period,
                e,
            )

        def _aggregate_trends(trends_1m: List[dict], interval_minutes: int) -> List[dict]:
            if interval_minutes <= 1:
                return sorted(trends_1m, key=lambda x: x["timestamp"])

            buckets: dict[int, dict] = {}
            for item in sorted(trends_1m, key=lambda x: x["timestamp"]):
                dt = pd.Timestamp(item["timestamp"], unit="s", tz=ASIA_SHANGHAI_TZ)

                # Respect A-share split sessions (09:30-11:30, 13:00-15:00).
                morning_start = dt.replace(hour=9, minute=30, second=0, microsecond=0)
                afternoon_start = dt.replace(hour=13, minute=0, second=0, microsecond=0)
                if dt.hour < 12:
                    session_start = morning_start
                else:
                    session_start = afternoon_start

                offset_minutes = int((dt - session_start).total_seconds() // 60)
                if offset_minutes < 0:
                    continue
                bucket_start = session_start + pd.Timedelta(
                    minutes=(offset_minutes // interval_minutes) * interval_minutes
                )
                bucket_ts = int(bucket_start.timestamp())

                existing = buckets.get(bucket_ts)
                if existing is None:
                    buckets[bucket_ts] = {
                        "timestamp": bucket_ts,
                        "open": item["open"],
                        "high": item["high"],
                        "low": item["low"],
                        "close": item["close"],
                        "volume": item.get("volume", 0),
                        "amount": item.get("amount", 0.0),
                    }
                else:
                    existing["high"] = max(existing["high"], item["high"])
                    existing["low"] = min(existing["low"], item["low"])
                    existing["close"] = item["close"]
                    existing["volume"] += item.get("volume", 0)
                    existing["amount"] += item.get("amount", 0.0)

            return [buckets[k] for k in sorted(buckets.keys())]

        # Fallback source: Eastmoney trends2 (1m data) -> aggregate to target period
        try:
            secid_prefix = "1" if str(symbol).startswith("6") else "0"
            trends_1m = eastmoney_client.fetch_intraday_trends(
                symbol=symbol,
                secid_prefix=secid_prefix,
                ndays=5,
                limit=max(1500, limit * int(period)),
            )
            if trends_1m:
                aggregated = _aggregate_trends(trends_1m, int(period))
                klines = []
                for item in aggregated[-limit:]:
                    kline = _normalize_ohlc(
                        {
                            "timestamp": int(item.get("timestamp", 0)),
                            "open": item.get("open"),
                            "high": item.get("high"),
                            "low": item.get("low"),
                            "close": item.get("close"),
                            "volume": self._safe_int(item.get("volume")),
                            "amount": self._safe_float(item.get("amount")),
                        }
                    )
                    if kline["timestamp"] > 0:
                        klines.append(kline)
                logger.info(
                    "Minute kline query for %s (%sm) returned %s results from Eastmoney trends fallback",
                    symbol,
                    period,
                    len(klines),
                )
                return klines

            # Secondary fallback: legacy push2his minute endpoint
            fallback = eastmoney_client.fetch_kline_data(
                symbol=symbol,
                secid_prefix=secid_prefix,
                period=period,
                limit=limit,
            )
            if not fallback:
                logger.error(
                    "Minute kline query failed for %s (%sm): empty fallback result",
                    symbol,
                    period,
                )
                return []

            klines = []
            for item in fallback:
                try:
                    kline = _normalize_ohlc(
                        {
                            "timestamp": int(item.get("timestamp", 0)),
                            "open": item.get("open"),
                            "high": item.get("high"),
                            "low": item.get("low"),
                            "close": item.get("close"),
                            "volume": self._safe_int(item.get("volume")),
                            "amount": self._safe_float(item.get("amount")),
                        }
                    )
                    if kline["timestamp"] > 0:
                        klines.append(kline)
                except Exception as e:
                    logger.warning(f"Failed to parse Eastmoney minute kline row: {e}")
                    continue

            klines = sorted(klines, key=lambda x: x["timestamp"])[-limit:]
            logger.info(
                "Minute kline query for %s (%sm) returned %s results from Eastmoney fallback",
                symbol,
                period,
                len(klines),
            )
            return klines
        except Exception as e:
            logger.error(f"Minute kline query failed for {symbol}: {e}")
            return []
    
    def _get_kline_from_tencent(self, symbol: str, period: str = "daily",
                                  start_date: Optional[str] = None,
                                  end_date: Optional[str] = None,
                                  limit: int = 300) -> List[dict]:
        """Fetch K-line data from Tencent Securities API (fallback source).
        
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
            # Add exchange prefix for Tencent API
            if symbol.startswith('6'):
                full_symbol = f"sh{symbol}"
            else:
                full_symbol = f"sz{symbol}"
            
            # Format dates for Tencent API (YYYYMMDD)
            start = start_date if start_date else "19000101"
            end = end_date if end_date else "20500101"
            
            df = ak.stock_zh_a_hist_tx(
                symbol=full_symbol,
                start_date=start,
                end_date=end,
                adjust=""  # No adjustment
            )
            
            if df.empty:
                logger.warning(f"Tencent API returned empty data for {symbol}")
                return []
            
            # Sort by date ascending
            df = df.sort_values('date')
            
            # Limit results
            df = df.tail(limit)
            
            klines = []
            for _, row in df.iterrows():
                try:
                    # Convert date string to timestamp
                    date_str = str(row['date'])
                    timestamp = int(pd.Timestamp(date_str).timestamp())
                    
                    # Note: Tencent 'amount' column is actually volume in '' (100 shares)
                    volume_hands = self._safe_float(row.get('amount'), 0.0)
                    volume_shares = int(volume_hands * 100)
                    
                    # Calculate approximate amount () 
                    # Using average of OHLC * volume for better accuracy
                    avg_price = (self._safe_float(row.get('open'), 0.0) + 
                                self._safe_float(row.get('high'), 0.0) + 
                                self._safe_float(row.get('low'), 0.0) + 
                                self._safe_float(row.get('close'), 0.0)) / 4
                    amount = avg_price * volume_shares
                    
                    kline = {
                        "timestamp": timestamp,
                        "open": self._safe_float(row.get('open'), 0.0),
                        "high": self._safe_float(row.get('high'), 0.0),
                        "low": self._safe_float(row.get('low'), 0.0),
                        "close": self._safe_float(row.get('close'), 0.0),
                        "volume": volume_shares,
                        "amount": amount if amount > 0 else None
                    }
                    klines.append(kline)
                except Exception as e:
                    logger.warning(f"Failed to parse Tencent kline row: {e}")
                    continue
            
            logger.info(f"Kline query for {symbol} returned {len(klines)} results from Tencent")
            return klines
            
        except Exception as e:
            logger.warning(f"Tencent kline API failed for {symbol}: {e}")
            return []
    
    def get_kline_data(self, symbol: str, period: str = "daily", 
                       start_date: Optional[str] = None,
                       end_date: Optional[str] = None,
                       limit: int = 300) -> List[dict]:
        """Get K-line historical data for a stock.
        
        Tries Eastmoney API first, falls back to Tencent if unavailable.
        
        Args:
            symbol: Stock symbol (e.g., '002326')
            period: Data period - 'daily', 'weekly', 'monthly'
            start_date: Start date (YYYYMMDD), optional
            end_date: End date (YYYYMMDD), optional
            limit: Maximum number of records
            
        Returns:
            List of K-line data points
        """
        # Map timeframe to AKShare period
        period_map = {
            "1D": "daily",
            "1W": "weekly", 
            "1M": "monthly"
        }
        ak_period = period_map.get(period, period)
        
        # Try Eastmoney API first (original method)
        try:
            if start_date is not None and end_date is not None:
                df = ak.stock_zh_a_hist(
                    symbol=symbol,
                    period=ak_period,
                    start_date=start_date,
                    end_date=end_date,
                )
            elif start_date is not None:
                df = ak.stock_zh_a_hist(
                    symbol=symbol,
                    period=ak_period,
                    start_date=start_date,
                )
            elif end_date is not None:
                df = ak.stock_zh_a_hist(
                    symbol=symbol,
                    period=ak_period,
                    end_date=end_date,
                )
            else:
                df = ak.stock_zh_a_hist(symbol=symbol, period=ak_period)
            
            if df.empty:
                raise ValueError("Empty response from Eastmoney")
            
            # Map Chinese column names to English
            column_mapping = {
                '日期': 'date',
                '开盘': 'open',
                '收盘': 'close',
                '最高': 'high',
                '最低': 'low',
                '成交量': 'volume',
                '成交额': 'amount',
            }
            df = df.rename(columns=column_mapping)
            
            # Limit results
            df = df.tail(limit)
            
            klines = []
            for _, row in df.iterrows():
                try:
                    date_str = str(row['date'])
                    timestamp = int(pd.Timestamp(date_str).timestamp())

                    open_price = self._safe_float(row.get('open'), 0.0)
                    close_price = self._safe_float(row.get('close'), 0.0)
                    high_price = self._safe_float(row.get('high'), 0.0)
                    low_price = self._safe_float(row.get('low'), 0.0)

                    # normalize any invalid zero values
                    if open_price <= 0 and close_price > 0:
                        open_price = close_price
                    if high_price <= 0:
                        high_price = max(open_price, close_price)
                    if low_price <= 0:
                        low_price = min(open_price, close_price)
                    high_price = max(high_price, open_price, close_price)
                    low_price = min(low_price, open_price, close_price)

                    kline = {
                        "timestamp": timestamp,
                        "open": open_price,
                        "high": high_price,
                        "low": low_price,
                        "close": close_price,
                        "volume": self._safe_int(row.get('volume')),
                        "amount": self._safe_float(row.get('amount'))
                    }
                    klines.append(kline)
                except Exception as e:
                    logger.warning(f"Failed to parse kline row: {e}")
                    continue
            
            logger.info(f"Kline query for {symbol} returned {len(klines)} results from Eastmoney")
            return klines
            
        except Exception as e:
            logger.warning(f"Eastmoney kline API failed for {symbol}: {e}, trying Tencent fallback")
            
        # Fallback to Tencent API
        return self._get_kline_from_tencent(symbol, period, start_date, end_date, limit)
    
    def get_kline_yearly(self, symbol: str, limit: int = 10) -> List[dict]:
        """Get yearly K-line data by aggregating monthly data.
        
        Issue #144, #147: Provides yearly OHLCV data for long-term trend analysis.
        
        Args:
            symbol: Stock symbol (e.g., '002326')
            limit: Maximum number of years to return (default 10, max 30)
            
        Returns:
            List of yearly K-line data points with OHLCV fields
        """
        try:
            # Limit check
            limit = min(max(limit, 1), 30)
            
            # Get monthly data (need extra months to ensure complete years)
            monthly_data = self.get_kline_data(
                symbol=symbol,
                period="monthly",
                limit=limit * 12 + 12  # Extra year for safety
            )
            
            if not monthly_data:
                logger.warning(f"No monthly data available for {symbol}")
                return []
            
            # Aggregate by year
            yearly_klines = []
            current_year = None
            year_data = None
            
            for kline in monthly_data:
                ts = kline["timestamp"]
                dt = datetime.fromtimestamp(ts, tz=ASIA_SHANGHAI_TZ)
                year = dt.year
                
                if year != current_year:
                    # Save previous year data
                    if year_data:
                        yearly_klines.append(year_data)
                    
                    # Start new year
                    current_year = year
                    year_data = {
                        "timestamp": int(datetime(year, 1, 1, tzinfo=ASIA_SHANGHAI_TZ).timestamp()),
                        "year": year,
                        "open": kline["open"],
                        "high": kline["high"],
                        "low": kline["low"],
                        "close": kline["close"],
                        "volume": kline["volume"],
                        "amount": kline.get("amount", 0)
                    }
                else:
                    # Update year data
                    year_data["high"] = max(year_data["high"], kline["high"])
                    year_data["low"] = min(year_data["low"], kline["low"])
                    year_data["close"] = kline["close"]
                    year_data["volume"] += kline["volume"]
                    year_data["amount"] += kline.get("amount", 0)
            
            # Don't forget the last year
            if year_data:
                yearly_klines.append(year_data)
            
            # Return only the requested number of years
            result = yearly_klines[-limit:] if len(yearly_klines) > limit else yearly_klines
            
            logger.info(f"Yearly kline query for {symbol} returned {len(result)} results")
            return result
            
        except Exception as e:
            logger.error(f"Yearly kline query failed for {symbol}: {e}")
            return []
    
    def incremental_update_yearly(self, symbol: str, existing_data: List[dict]) -> dict:
        """Incrementally update yearly K-line data.
        
        Issue #147: Smart merge of new yearly data with existing data.
        
        Args:
            symbol: Stock symbol
            existing_data: Existing yearly K-line data
            
        Returns:
            Update result with metadata
        """
        try:
            # Get latest year from existing data
            latest_year = None
            if existing_data:
                latest_year = max(d.get("year", 0) for d in existing_data)
            
            # Fetch new data
            new_data = self.get_kline_yearly(symbol, limit=30)
            
            if not new_data:
                return {
                    "symbol": symbol,
                    "records_added": 0,
                    "records_updated": 0,
                    "message": "No new data available"
                }
            
            # Create lookup for existing years
            existing_years = {d.get("year"): d for d in existing_data}
            
            added = 0
            updated = 0
            merged_data = []
            
            for new_kline in new_data:
                year = new_kline.get("year")
                
                if year not in existing_years:
                    # New year
                    merged_data.append(new_kline)
                    added += 1
                elif latest_year and year == latest_year:
                    # Update current year (may have new monthly data)
                    merged_data.append(new_kline)
                    updated += 1
                else:
                    # Keep existing year data
                    merged_data.append(existing_years[year])
            
            # Sort by year
            merged_data.sort(key=lambda x: x.get("year", 0))
            
            return {
                "symbol": symbol,
                "records_added": added,
                "records_updated": updated,
                "date_range": {
                    "start": merged_data[0].get("year") if merged_data else None,
                    "end": merged_data[-1].get("year") if merged_data else None
                },
                "data": merged_data
            }
            
        except Exception as e:
            logger.error(f"Incremental update failed for {symbol}: {e}")
            return {
                "symbol": symbol,
                "records_added": 0,
                "records_updated": 0,
                "error": str(e)
            }
    
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

    @staticmethod
    def _safe_float_required(value, default: float = 0.0) -> float:
        """Safely convert value to float and always return a float."""
        result = AKShareClient._safe_float(value, default)
        if result is None:
            return default
        return result

    @staticmethod
    def _safe_int_required(value, default: int = 0) -> int:
        """Safely convert value to int and always return an int."""
        result = AKShareClient._safe_int(value, default)
        if result is None:
            return default
        return result


# Global client instance
akshare_client = AKShareClient()
