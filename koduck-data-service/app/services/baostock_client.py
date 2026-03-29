"""Client library wrapping BaoStock APIs for A-share historical data.

This module provides a high-level client that wraps the baostock Python
library (https://www.baostock.com) for fetching historical K-line data.
BaoStock offers free, stable access to A-share market data going back to
1990, making it an excellent complementary source to AKShare.

The client manages login/logout lifecycle, symbol format conversion, and
data normalization into a consistent internal format.
"""

import logging
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

import baostock as bs
import pandas as pd

logger = logging.getLogger(__name__)

# BaoStock frequency parameter mapping
FREQUENCY_DAILY = "d"
FREQUENCY_WEEKLY = "w"
FREQUENCY_MONTHLY = "m"

# Adjustment flag constants
ADJUST_NONE = "3"  # No adjustment (不复权)
ADJUST_FORWARD = "2"  # Forward adjustment (前复权)
ADJUST_BACKWARD = "1"  # Backward adjustment (后复权)

# Monthly K-line fields (周月线指标 per baostock docs)
MONTHLY_KLINE_FIELDS = (
    "date,code,open,high,low,close,volume,amount,adjustflag,turn,pctChg"
)

# Daily/Weekly K-line fields (includes more indicators)
DAILY_KLINE_FIELDS = (
    "date,code,open,high,low,close,preclose,volume,amount,"
    "adjustflag,turn,tradestatus,pctChg,isST"
)


class BaoStockClientError(Exception):
    """Base exception for BaoStock client errors."""


class BaoStockLoginError(BaoStockClientError):
    """Raised when login to BaoStock server fails."""


class BaoStockQueryError(BaoStockClientError):
    """Raised when a BaoStock data query fails."""


def _convert_symbol_to_baostock(symbol: str) -> str:
    """Convert a plain stock symbol to BaoStock format.

    BaoStock uses ``sh.XXXXXX`` for Shanghai stocks (codes starting with 6)
    and ``sz.XXXXXX`` for Shenzhen stocks (codes starting with 0, 1, 2, 3).

    If the symbol already contains a dot prefix (e.g. ``sh.600000``), it is
    returned unchanged.

    Args:
        symbol: Plain 6-digit stock code (e.g. ``"600000"`` or ``"000001"``).

    Returns:
        BaoStock-formatted symbol (e.g. ``"sh.600000"`` or ``"sz.000001"``).
    """
    if "." in symbol:
        return symbol.lower()

    code = symbol.strip().zfill(6)

    # Shanghai Stock Exchange: codes starting with 6
    if code.startswith("6"):
        return f"sh.{code}"
    # Shenzhen Stock Exchange: codes starting with 0, 1, 2, 3
    else:
        return f"sz.{code}"


def _convert_symbol_from_baostock(bs_symbol: str) -> str:
    """Convert a BaoStock symbol back to plain 6-digit format.

    Args:
        bs_symbol: BaoStock symbol (e.g. ``"sh.600000"``).

    Returns:
        Plain 6-digit code (e.g. ``"600000"``).
    """
    if "." in bs_symbol:
        return bs_symbol.split(".", 1)[1]
    return bs_symbol


class BaoStockClient:
    """Fetch historical A-share market data through BaoStock.

    BaoStock provides free historical K-line data (daily, weekly, monthly,
    and minute-level) going back to 1990-12-19. This client wraps the
    baostock library with proper login/logout lifecycle management and
    data normalization.

    Thread safety:
        All baostock operations are serialized via a class-level lock
        because the underlying ``baostock`` library uses a single socket
        connection.
    """

    _lock = threading.Lock()

    def __init__(self):
        """Initialize the client (no eager login)."""
        self._logged_in = False

    @contextmanager
    def _ensure_login(self):
        """Context manager that ensures login/logout around operations.

        Login is performed on entry and logout on exit, guaranteeing a
        clean session even when exceptions occur.
        """
        with self._lock:
            try:
                lg = bs.login()
                if lg.error_code != "0":
                    raise BaoStockLoginError(
                        f"BaoStock login failed: error_code={lg.error_code}, "
                        f"error_msg={lg.error_msg}"
                    )
                self._logged_in = True
                yield
            finally:
                try:
                    bs.logout()
                except Exception:
                    pass
                self._logged_in = False

    def _query_k_data_plus(
        self,
        symbol: str,
        fields: str,
        start_date: str = "1990-01-01",
        end_date: str = "2099-12-31",
        frequency: str = FREQUENCY_MONTHLY,
        adjustflag: str = ADJUST_NONE,
    ) -> pd.DataFrame:
        """Execute a ``query_history_k_data_plus`` call and return a DataFrame.

        Args:
            symbol: BaoStock-format symbol (e.g. ``"sh.600000"``).
            fields: Comma-separated field list.
            start_date: Start date in ``YYYY-MM-DD`` format.
            end_date: End date in ``YYYY-MM-DD`` format.
            frequency: ``"d"``, ``"w"``, or ``"m"``.
            adjustflag: ``"1"`` (backward), ``"2"`` (forward), ``"3"`` (none).

        Returns:
            A DataFrame with the requested fields as columns.

        Raises:
            BaoStockQueryError: When the query returns a non-zero error code.
        """
        rs = bs.query_history_k_data_plus(
            symbol,
            fields,
            start_date=start_date,
            end_date=end_date,
            frequency=frequency,
            adjustflag=adjustflag,
        )

        if rs.error_code != "0":
            raise BaoStockQueryError(
                f"BaoStock query failed: error_code={rs.error_code}, "
                f"error_msg={rs.error_msg}, symbol={symbol}"
            )

        data_list = []
        while rs.next():
            data_list.append(rs.get_row_data())

        if not data_list:
            return pd.DataFrame(columns=rs.fields)

        return pd.DataFrame(data_list, columns=rs.fields)

    @staticmethod
    def _safe_float(value, default: Optional[float] = None) -> Optional[float]:
        """Safely convert a value to float.

        BaoStock returns all values as strings, so conversion is needed.
        """
        if value is None or value == "" or pd.isna(value):
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _safe_int(value, default: Optional[int] = None) -> Optional[int]:
        """Safely convert a value to int."""
        if value is None or value == "" or pd.isna(value):
            return default
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return default

    def _normalize_kline_df(self, df: pd.DataFrame) -> list[dict]:
        """Normalize a BaoStock K-line DataFrame into internal format.

        Converts string columns to proper numeric types and maps column
        names to the internal schema used by the data service.

        Args:
            df: Raw DataFrame from BaoStock query.

        Returns:
            List of dicts with keys: ``timestamp``, ``open``, ``high``,
            ``low``, ``close``, ``volume``, ``amount``, and optional
            ``turn``, ``pct_chg``.
        """
        if df.empty:
            return []

        klines = []
        for _, row in df.iterrows():
            date_str = str(row.get("date", ""))
            if not date_str:
                continue

            try:
                timestamp = int(
                    pd.Timestamp(date_str).timestamp()
                )
            except Exception:
                continue

            open_price: float = self._safe_float(row.get("open"), 0.0) or 0.0
            close_price: float = self._safe_float(row.get("close"), 0.0) or 0.0
            high_price: float = self._safe_float(row.get("high"), 0.0) or 0.0
            low_price: float = self._safe_float(row.get("low"), 0.0) or 0.0

            # Normalize invalid zero OHLC values
            if open_price <= 0 and close_price > 0:
                open_price = close_price
            if high_price <= 0:
                high_price = max(open_price, close_price)
            if low_price <= 0:
                low_price = min(open_price, close_price)
            if high_price > 0:
                high_price = max(high_price, open_price, close_price)
            if low_price > 0:
                low_price = min(low_price, open_price, close_price)

            kline = {
                "timestamp": timestamp,
                "date": date_str,
                "open": open_price,
                "high": high_price,
                "low": low_price,
                "close": close_price,
                "volume": self._safe_int(row.get("volume")),
                "amount": self._safe_float(row.get("amount")),
            }

            # Optional fields
            turn = self._safe_float(row.get("turn"))
            if turn is not None:
                kline["turn"] = turn

            pct_chg = self._safe_float(row.get("pctChg"))
            if pct_chg is not None:
                kline["pct_chg"] = pct_chg

            preclose = self._safe_float(row.get("preclose"))
            if preclose is not None:
                kline["preclose"] = preclose

            klines.append(kline)

        return klines

    def get_monthly_kline(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjustflag: str = ADJUST_NONE,
    ) -> list[dict]:
        """Fetch monthly K-line data for an A-share stock.

        Uses BaoStock's ``query_history_k_data_plus`` with
        ``frequency="m"`` to retrieve historical monthly OHLCV data.

        Args:
            symbol: Plain stock code (e.g. ``"600000"`` or ``"000001"``).
                BaoStock-format codes (``"sh.600000"``) are also accepted.
            start_date: Start date in ``YYYY-MM-DD`` format.
                Defaults to ``"1990-01-01"`` to get all available history.
            end_date: End date in ``YYYY-MM-DD`` format.
                Defaults to today.
            adjustflag: Adjustment flag — ``"1"`` backward,
                ``"2"`` forward, ``"3"`` none (default).

        Returns:
            List of monthly K-line dicts sorted by date ascending.
            Each dict contains: ``timestamp``, ``date``, ``open``,
            ``high``, ``low``, ``close``, ``volume``, ``amount``,
            and optionally ``turn``, ``pct_chg``.

        Example:
            >>> client = BaoStockClient()
            >>> data = client.get_monthly_kline("601398", start_date="2020-01-01")
            >>> len(data) > 0
            True
        """
        bs_symbol = _convert_symbol_to_baostock(symbol)
        start = start_date or "1990-01-01"
        end = end_date or datetime.now().strftime("%Y-%m-%d")

        logger.info(
            "Fetching monthly kline from BaoStock: symbol=%s, "
            "start=%s, end=%s, adjustflag=%s",
            bs_symbol, start, end, adjustflag,
        )

        with self._ensure_login():
            df = self._query_k_data_plus(
                symbol=bs_symbol,
                fields=MONTHLY_KLINE_FIELDS,
                start_date=start,
                end_date=end,
                frequency=FREQUENCY_MONTHLY,
                adjustflag=adjustflag,
            )

        klines = self._normalize_kline_df(df)
        logger.info(
            "BaoStock monthly kline for %s returned %d records",
            bs_symbol, len(klines),
        )
        return klines

    def get_weekly_kline(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjustflag: str = ADJUST_NONE,
    ) -> list[dict]:
        """Fetch weekly K-line data for an A-share stock.

        Args:
            symbol: Plain stock code or BaoStock-format code.
            start_date: Start date (YYYY-MM-DD). Defaults to 1990-01-01.
            end_date: End date (YYYY-MM-DD). Defaults to today.
            adjustflag: Adjustment flag (default: no adjustment).

        Returns:
            List of weekly K-line dicts sorted by date ascending.
        """
        bs_symbol = _convert_symbol_to_baostock(symbol)
        start = start_date or "1990-01-01"
        end = end_date or datetime.now().strftime("%Y-%m-%d")

        logger.info(
            "Fetching weekly kline from BaoStock: symbol=%s, "
            "start=%s, end=%s, adjustflag=%s",
            bs_symbol, start, end, adjustflag,
        )

        with self._ensure_login():
            df = self._query_k_data_plus(
                symbol=bs_symbol,
                fields=MONTHLY_KLINE_FIELDS,
                start_date=start,
                end_date=end,
                frequency=FREQUENCY_WEEKLY,
                adjustflag=adjustflag,
            )

        klines = self._normalize_kline_df(df)
        logger.info(
            "BaoStock weekly kline for %s returned %d records",
            bs_symbol, len(klines),
        )
        return klines

    def get_daily_kline(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjustflag: str = ADJUST_NONE,
    ) -> list[dict]:
        """Fetch daily K-line data for an A-share stock.

        Args:
            symbol: Plain stock code or BaoStock-format code.
            start_date: Start date (YYYY-MM-DD). Defaults to 1990-01-01.
            end_date: End date (YYYY-MM-DD). Defaults to today.
            adjustflag: Adjustment flag (default: no adjustment).

        Returns:
            List of daily K-line dicts sorted by date ascending.
        """
        bs_symbol = _convert_symbol_to_baostock(symbol)
        start = start_date or "1990-01-01"
        end = end_date or datetime.now().strftime("%Y-%m-%d")

        logger.info(
            "Fetching daily kline from BaoStock: symbol=%s, "
            "start=%s, end=%s, adjustflag=%s",
            bs_symbol, start, end, adjustflag,
        )

        with self._ensure_login():
            df = self._query_k_data_plus(
                symbol=bs_symbol,
                fields=DAILY_KLINE_FIELDS,
                start_date=start,
                end_date=end,
                frequency=FREQUENCY_DAILY,
                adjustflag=adjustflag,
            )

        klines = self._normalize_kline_df(df)
        logger.info(
            "BaoStock daily kline for %s returned %d records",
            bs_symbol, len(klines),
        )
        return klines

    def check_health(self) -> dict:
        """Verify connectivity to BaoStock server.

        Returns:
            Dict with ``status`` (``"ok"`` or ``"error"``) and
            ``message`` with details.
        """
        try:
            with self._ensure_login():
                return {
                    "status": "ok",
                    "message": "BaoStock server connection successful",
                }
        except BaoStockLoginError as e:
            return {
                "status": "error",
                "message": str(e),
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Unexpected error: {e}",
            }


# Global client instance
baostock_client = BaoStockClient()
