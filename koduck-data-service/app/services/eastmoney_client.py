"""Eastmoney API client with browser simulation and automatic cookie management."""

import asyncio
import concurrent.futures
import gzip
import json
import logging
import os
import random
import time
import urllib.error
import urllib.request
import zlib
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

logger = logging.getLogger(__name__)

# Browser-like User-Agent pool
USER_AGENTS = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 "
        "Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 "
        "Safari/605.1.15"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) "
        "Gecko/20100101 Firefox/121.0"
    ),
]

# Eastmoney API endpoints
EASTMONEY_HOSTS = [
    "push2.eastmoney.com",
    "7.push2.eastmoney.com",
    "8.push2.eastmoney.com",
    "9.push2.eastmoney.com",
    "10.push2.eastmoney.com",
]

QUOTE_PAGE_URL = "https://quote.eastmoney.com/center/gridlist.html#hs_a_board"

# Default stock for cookie refresh (when watchlist is empty)
DEFAULT_COOKIE_STOCKS = ["sh603777", "sh600519", "sz000001", "sh601012", "sz002594"]
DATA_DIR = Path(__file__).parent.parent.parent / "data"
ASIA_SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


class EastmoneyClient:
    """Eastmoney API client that mimics a browser.

    This helper encapsulates the low-level HTTP logic required to fetch data
    from the Eastmoney push API. It automatically manages cookies by visiting
    the public quote page, applies a lightweight rate limiter to avoid
    triggering anti-scraping mechanisms, and exposes a small set of convenience
    methods returning pandas ``DataFrame`` objects or plain dictionaries.

    The internal state (cookie string, last request timestamp, etc.) is
    guarded by a ``threading.Lock`` so a single instance may safely be shared
    across multiple threads.
    """
    def __init__(self) -> None:
        """Create an empty client instance.

        All internal counters and timestamps are initialized. No network traffic
        occurs during construction; the first real request will trigger a
        cookie refresh.
        """
        # Import settings here to avoid circular import
        from app.config import settings

        self._state_lock = Lock()
        self._cookie: str | None = None
        self._cookie_timestamp: datetime | None = None
        self._cookie_ttl_seconds = settings.EASTMONEY_COOKIE_TTL

        self._request_count = 0
        self._last_request_time = 0.0
        self._min_request_interval = settings.EASTMONEY_MIN_REQUEST_INTERVAL
        
        # Check for preset cookie from environment variable
        self._preset_cookie = os.environ.get("EASTMONEY_COOKIE")
        if self._preset_cookie:
            logger.info("Using preset cookie from EASTMONEY_COOKIE environment variable")
            with self._state_lock:
                self._cookie = self._preset_cookie
                self._cookie_timestamp = datetime.now(UTC)

    def _get_headers(self, referer: str | None = None) -> dict[str, str]:
        """Construct HTTP headers that resemble a normal browser.

        The ``User-Agent`` is chosen randomly from a small pool.  If a cookie
        has been stored it is added to the ``Cookie`` header.  An optional
        ``Referer`` value may be supplied; otherwise the Eastmoney quote page is
        used.

        Args:
            referer: URL to use for the ``Referer`` header, or ``None``.

        Returns:
            A dictionary suitable for ``urllib.request.Request``.
        """
        with self._state_lock:
            cookie = self._cookie

        headers = {
            "User-Agent": random.choice(USER_AGENTS),  # noqa: S311
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
        }

        if referer:
            headers["Referer"] = referer
        else:
            headers["Referer"] = QUOTE_PAGE_URL

        if cookie:
            headers["Cookie"] = cookie

        return headers

    def _get_cookie_stock(self) -> str:
        """Get a stock symbol to use for cookie refresh.
        
        Tries to use stocks from:
        1. CSV files in data/kline/1D/ directory
        2. DEFAULT_COOKIE_STOCKS if no CSV files exist
        
        Returns:
            Stock symbol with exchange prefix (e.g., "sh603777")
        """
        try:
            # Try to get stocks from CSV files
            kline_dir = DATA_DIR / "kline" / "1D"
            if kline_dir.exists():
                csv_files = list(kline_dir.glob("*.csv"))
                if csv_files:
                    # Pick a random stock from CSV files
                    stock_code = random.choice(csv_files).stem  # noqa: S311
                    # Add exchange prefix
                    if stock_code.startswith("6"):
                        return f"sh{stock_code}"
                    else:
                        return f"sz{stock_code}"
        except Exception as e:
            logger.debug(f"Failed to get stock from CSV: {e}")
        
        # Fallback to default stocks
        return random.choice(DEFAULT_COOKIE_STOCKS)  # noqa: S311

    def _refresh_cookie(self, force: bool = False) -> bool:
        """Obtain a fresh session cookie from Eastmoney using Playwright.

        Playwright is used to simulate a real browser visiting a concept page
        for a stock from the watchlist/CSV, which allows JavaScript to set 
        cookies properly. The cookies are then stored for subsequent API requests.

        Args:
            force: If True, refresh cookie even if current one is still valid.

        Returns:
            ``True`` if one or more cookies were successfully captured; ``False``
            otherwise (including network errors).
        """
        # Check if we already have a valid cookie (unless force=True)
        if not force:
            with self._state_lock:
                cookie = self._cookie
                cookie_timestamp = self._cookie_timestamp
                
            now = datetime.now(UTC)
            if cookie and cookie_timestamp:
                age = (now - cookie_timestamp).total_seconds()
                if age < self._cookie_ttl_seconds:
                    logger.debug(f"Cookie still valid (age: {age:.0f}s), skipping refresh")
                    return True
        
        try:
            # Import check first so missing dependency still falls back clearly.
            from playwright.sync_api import sync_playwright as _sync_playwright  # noqa: F401

            # Get a stock to use for cookie refresh
            stock = self._get_cookie_stock()
            logger.info(f"Refreshing cookie using Playwright browser (stock: {stock})...")

            try:
                asyncio.get_running_loop()
                in_event_loop = True
            except RuntimeError:
                in_event_loop = False

            if in_event_loop:
                # Avoid Playwright Sync API usage directly in asyncio event loop.
                return self._refresh_cookie_with_playwright_threaded(stock)
            return self._refresh_cookie_with_playwright_sync(stock)

        except ImportError:
            logger.warning("Playwright not installed, falling back to HTTP request")
            return self._refresh_cookie_fallback()
        except Exception as error:
            logger.warning("Failed to refresh cookie with Playwright: %s", error)
            return self._refresh_cookie_fallback()

    def _refresh_cookie_with_playwright_threaded(self, stock: str) -> bool:
        """Run Playwright sync API in a worker thread when asyncio loop is active."""
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(self._refresh_cookie_with_playwright_sync, stock)
                return bool(future.result(timeout=45))
        except Exception as error:
            logger.warning("Threaded Playwright cookie refresh failed: %s", error)
            return self._refresh_cookie_fallback()

    def _refresh_cookie_with_playwright_sync(self, stock: str) -> bool:
        """Refresh cookie using Playwright Sync API in a non-asyncio context."""
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            # Launch browser in headless mode
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=random.choice(USER_AGENTS)  # noqa: S311
            )
            page = context.new_page()

            # Visit concept page for the selected stock
            url = f"https://quote.eastmoney.com/concept/{stock}.html?from=classic"
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)  # Wait for JavaScript to execute

            # Get all cookies
            cookies = context.cookies()
            browser.close()

            if cookies:
                # Format cookie string
                cookie_parts = [f"{c['name']}={c['value']}" for c in cookies]
                cookie_str = "; ".join(cookie_parts)

                with self._state_lock:
                    self._cookie = cookie_str
                    self._cookie_timestamp = datetime.now(UTC)

                logger.info(
                    "Cookie refreshed with %s cookies from Playwright (stock: %s)",
                    len(cookies),
                    stock,
                )
                return True

            logger.warning("No cookies received from Playwright")
            return False
    
    def _refresh_cookie_fallback(self) -> bool:
        """Fallback method to obtain cookies using HTTP request.

        Returns:
            ``True`` if one or more cookies were successfully captured; ``False``
            otherwise.
        """
        try:
            url = QUOTE_PAGE_URL

            req = urllib.request.Request(url, method="GET")  # noqa: S310
            req.add_header("User-Agent", random.choice(USER_AGENTS))  # noqa: S311
            req.add_header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            req.add_header("Accept-Language", "zh-CN,zh;q=0.9")

            response = urllib.request.urlopen(req, timeout=30)  # noqa: S310

            # Extract cookies from response
            cookie_parts = []
            
            # Try different methods to get cookies
            if hasattr(response.headers, 'get_all'):
                try:
                    cookies = response.headers.get_all("Set-Cookie") or []
                    for cookie in cookies:
                        part = cookie.split(";")[0].strip()
                        if part:
                            cookie_parts.append(part)
                except:
                    pass
            
            # Also try accessing _headers directly
            if not cookie_parts and hasattr(response.headers, '_headers'):
                for name, value in response.headers._headers:
                    if name.lower() == 'set-cookie':
                        part = value.split(";")[0].strip()
                        if part:
                            cookie_parts.append(part)

            if cookie_parts:
                with self._state_lock:
                    self._cookie = "; ".join(cookie_parts)
                    self._cookie_timestamp = datetime.now(UTC)
                logger.info(
                    "Cookie refreshed with %s cookies (fallback)",
                    len(cookie_parts),
                )
                return True

            logger.warning("No cookies received from main page (fallback)")
            return False

        except (urllib.error.URLError, TimeoutError) as error:
            logger.warning("Failed to refresh cookie (fallback): %s", error)
            return False

    def _ensure_cookie(self) -> bool:
        """Verify that a non‑expired cookie is available.

        The stored cookie is considered stale if more than ``_cookie_ttl_seconds``
        have elapsed since it was obtained.  If no cookie exists or it has
        expired, ``_refresh_cookie`` is invoked.

        Returns:
            ``True`` if a (new or existing) cookie is present; ``False`` if the
            refresh attempt failed.
        """
        now = datetime.now(UTC)

        with self._state_lock:
            cookie = self._cookie
            cookie_timestamp = self._cookie_timestamp

        # Check if cookie needs refresh
        needs_refresh = (
            cookie is None
            or cookie_timestamp is None
            or (now - cookie_timestamp).total_seconds() >= self._cookie_ttl_seconds
        )
        
        if needs_refresh:
            return self._refresh_cookie(force=True)

        return True

    def _rate_limit(self) -> None:
        """Sleep briefly to enforce a minimum interval between requests.

        This private helper updates the ``_last_request_time`` and increments
        ``_request_count``; both operations are performed while holding the
        internal lock.
        """
        with self._state_lock:
            now = time.time()
            elapsed = now - self._last_request_time
            if elapsed < self._min_request_interval:
                time.sleep(self._min_request_interval - elapsed)
            self._last_request_time = time.time()
            self._request_count += 1

    @staticmethod
    def _extract_cookie_parts(cookies: list[str] | None) -> list[str]:
        """Normalize ``Set-Cookie`` header values.

        Args:
            cookies: List of raw ``Set-Cookie`` header strings or ``None``.

        Returns:
            A list of ``name=value`` segments suitable for inclusion in the
            ``Cookie`` request header.
        """
        if not cookies:
            return []

        parts: list[str] = []
        for cookie in cookies:
            part = cookie.split(";")[0].strip()
            if part:
                parts.append(part)
        return parts

    def _update_cookie_from_headers(self, cookies: list[str] | None) -> None:
        """Store cookie string derived from response headers.

        Args:
            cookies: Raw ``Set-Cookie`` header values returned by the server.
        """
        cookie_parts = self._extract_cookie_parts(cookies)
        if not cookie_parts:
            return

        with self._state_lock:
            self._cookie = "; ".join(cookie_parts)
            self._cookie_timestamp = datetime.now(UTC)

    def _build_get_request(self, url: str) -> urllib.request.Request:
        """Prepare a GET request object prepopulated with headers.

        Args:
            url: Destination URL.

        Returns:
            ``urllib.request.Request`` instance ready for ``urlopen``.
        """
        req = urllib.request.Request(url, method="GET")  # noqa: S310
        for key, value in self._get_headers().items():
            req.add_header(key, value)
        return req

    @staticmethod
    def _decode_json_bytes(content: bytes, encoding: str) -> dict[str, Any]:
        """Decode compressed/raw payload bytes into a JSON object."""
        normalized = (encoding or "").lower()
        decoded = content

        if "gzip" in normalized:
            decoded = gzip.decompress(decoded)
        elif "deflate" in normalized:
            try:
                decoded = zlib.decompress(decoded)
            except zlib.error:
                decoded = zlib.decompress(decoded, -zlib.MAX_WBITS)

        # Header may be missing/misleading; sniff common gzip signatures.
        if len(decoded) >= 2 and decoded[:2] == b"\x1f\x8b":
            decoded = gzip.decompress(decoded)
        elif decoded and decoded[0] == 0x8B:
            try:
                decoded = gzip.decompress(decoded)
            except (OSError, EOFError, gzip.BadGzipFile):
                pass

        return json.loads(decoded.decode("utf-8"))

    @classmethod
    def _decode_json_response(cls, response: Any) -> dict[str, Any] | None:
        """Read an HTTP response and decode JSON content.

        Args:
            response: Object returned by ``urllib.request.urlopen``.

        Returns:
            Parsed JSON dictionary on success, or ``None`` if the payload could
            not be decoded or was not a JSON object.
        """
        content = response.read()
        encoding = response.headers.get("Content-Encoding", "")
        data = cls._decode_json_bytes(content, encoding)
        if not isinstance(data, dict):
            logger.warning("Unexpected response payload type: %s", type(data))
            return None
        return data

    def _request_once(self, url: str) -> dict[str, Any] | None:
        """Perform one HTTP GET and return parsed JSON.

        Args:
            url: Target URL.

        Returns:
            Decoded JSON dictionary, or ``None`` if the request failed.
        """
        req = self._build_get_request(url)
        response = urllib.request.urlopen(  # noqa: S310
            req,
            timeout=30,
        )
        self._update_cookie_from_headers(response.headers.get_all("Set-Cookie"))
        return self._decode_json_response(response)

    def _handle_api_error_response(
        self,
        data: dict[str, Any],
        attempt: int,
        max_retries: int,
    ) -> bool:
        """Inspect API payload for an error code and optionally retry.

        Args:
            data: Parsed JSON response.
            attempt: Current retry attempt index (0-based).
            max_retries: Maximum number of attempts allowed.

        Returns:
            ``True`` if the calling routine should retry the request, ``False``
            otherwise.
        """
        if data.get("rc") != -1:
            return False

        logger.warning("API error: %s", data)
        if attempt < max_retries - 1:
            self._refresh_cookie()
            time.sleep(0.5 * (attempt + 1))
            return True
        return False

    def _execute_attempt(
        self,
        url: str,
        attempt: int,
        max_retries: int,
    ) -> tuple[bool, dict[str, Any] | None]:
        """Run a single try of ``_make_request`` logic.

        Args:
            url: Request URL.
            attempt: Index of the current attempt (0-based).
            max_retries: Allowed number of attempts.

        Returns:
            A pair ``(should_retry, data)`` where ``should_retry`` indicates
            whether the caller should loop again, and ``data`` is the parsed
            response (``None`` if the request failed or will be retried).
        """
        try:
            if not self._ensure_cookie():
                logger.warning("Failed to ensure cookie, trying without cookie")

            self._rate_limit()
            data = self._request_once(url)
            if data is None:
                return False, None
            if self._handle_api_error_response(data, attempt, max_retries):
                return True, None
            return False, data
        except urllib.error.HTTPError as error:
            return self._should_retry_http_error(error, attempt, max_retries), None
        except (
            urllib.error.URLError,
            json.JSONDecodeError,
            gzip.BadGzipFile,
            UnicodeDecodeError,
            TimeoutError,
        ) as error:
            return self._should_retry_runtime_error(error, attempt, max_retries), None

    def _should_retry_http_error(
        self,
        error: urllib.error.HTTPError,
        attempt: int,
        max_retries: int,
    ) -> bool:
        """Decide if an ``HTTPError`` warrants another request.

        Args:
            error: The exception thrown by ``urllib``.
            attempt: Current retry attempt index.
            max_retries: Maximum attempts allowed.

        Returns:
            ``True`` if the error is transient (e.g. 403/429) and a retry should
            be made; ``False`` otherwise.
        """
        logger.warning(
            "HTTP error %s on attempt %s: %s",
            error.code,
            attempt + 1,
            error.reason,
        )
        if error.code in {403, 429} and attempt < max_retries - 1:
            self._refresh_cookie()
            time.sleep(1.0 * (attempt + 1))
            return True
        return False

    def _should_retry_runtime_error(
        self,
        error: Exception,
        attempt: int,
        max_retries: int,
    ) -> bool:
        """Determine if a non-HTTP exception should be retried.

        Args:
            error: The caught exception (network, JSON decode, etc.).
            attempt: Retry count so far.
            max_retries: Allowed number of retries.

        Returns:
            ``True`` if another attempt should be made; ``False`` otherwise.
        """
        logger.warning(
            "Request failed on attempt %s: %s",
            attempt + 1,
            error,
        )
        if attempt < max_retries - 1:
            time.sleep(0.5 * (attempt + 1))
            return True
        return False

    def _make_request(self, url: str, max_retries: int = 3) -> dict[str, Any] | None:
        """Make a request with retry logic and automatic cookie refresh.

        Args:
            url: The URL to request
            max_retries: Maximum number of retries

        Returns:
            JSON response as dict, or None if failed
        """
        for attempt in range(max_retries):
            should_retry, data = self._execute_attempt(url, attempt, max_retries)
            if should_retry:
                continue
            return data

        return None

    def fetch_stock_list(self, page_size: int = 100) -> pd.DataFrame:
        """Fetch complete A-share stock list.

        Args:
            page_size: Number of stocks per page (max 100)

        Returns:
            DataFrame with stock data

        Raises:
            ValueError: If ``page_size`` is not in the range 1..100.
        """
        if not 1 <= page_size <= 100:
            raise ValueError("page_size must be between 1 and 100")

        all_rows: list[dict[str, Any]] = []
        page = 1
        max_pages = 50
        total: int | None = None

        # Fields include code/name/price/change and top-of-book quote snapshots.
        fields = "f12,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f31,f32,f33,f34"

        host = random.choice(EASTMONEY_HOSTS)  # noqa: S311

        while page <= max_pages:
            url = (
                f"https://{host}/api/qt/clist/get?"
                f"pn={page}&pz={page_size}&po=1&np=1&fltt=2&invt=2&fid=f12&"
                f"fs=m:0+t:6,m:0+t:13,m:1+t:2,m:1+t:23&"
                f"fields={fields}"
            )

            data = self._make_request(url)

            if not data or not data.get("data") or not data["data"].get("diff"):
                logger.warning("No data on page %s", page)
                break

            stocks = data["data"]["diff"]
            if not stocks:
                break

            if total is None:
                total = data["data"].get("total", 0)
                logger.info("Total stocks to fetch: %s", total)

            for stock in stocks:
                all_rows.append(
                    {
                        "symbol": stock.get("f12"),
                        "name": stock.get("f14"),
                        "price": stock.get("f2"),
                        "change_percent": stock.get("f3"),
                        "change": stock.get("f4"),
                        "volume": stock.get("f5"),
                        "amount": stock.get("f6"),
                        "high": stock.get("f15"),
                        "low": stock.get("f16"),
                        "open": stock.get("f17"),
                        "prev_close": stock.get("f18"),
                        "bid_price": stock.get("f31"),
                        "bid_volume": stock.get("f32"),
                        "ask_price": stock.get("f33"),
                        "ask_volume": stock.get("f34"),
                    }
                )

            logger.debug(
                "Page %s: fetched %s stocks, total: %s",
                page,
                len(stocks),
                len(all_rows),
            )

            if total is not None and len(all_rows) >= total:
                break

            page += 1

        df = pd.DataFrame(all_rows)
        with self._state_lock:
            request_count = self._request_count
        logger.info(
            "Fetched %s stocks from Eastmoney (%s pages, %s requests)",
            len(df),
            page,
            request_count,
        )
        return df

    def fetch_index_list(self) -> pd.DataFrame:
        """Fetch market index list.

        Returns:
            DataFrame containing index quote snapshots.
        """
        all_rows: list[dict[str, Any]] = []
        page = 1
        per_page = 100
        max_pages = 5
        fields = "f12,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18"

        host = random.choice(EASTMONEY_HOSTS)  # noqa: S311

        while page <= max_pages:
            url = (
                f"https://{host}/api/qt/clist/get?"
                f"pn={page}&pz={per_page}&po=1&np=1&fltt=2&invt=2&fid=f12&"
                f"fs=m:1+s:2,m:0+s:2&"
                f"fields={fields}"
            )

            data = self._make_request(url)

            if not data or not data.get("data") or not data["data"].get("diff"):
                break

            indices = data["data"]["diff"]
            if not indices:
                break

            for idx in indices:
                all_rows.append(
                    {
                        "symbol": idx.get("f12"),
                        "name": idx.get("f14"),
                        "price": idx.get("f2"),
                        "change": idx.get("f4"),
                        "change_percent": idx.get("f3"),
                        "high": idx.get("f15"),
                        "low": idx.get("f16"),
                        "open": idx.get("f17"),
                        "prev_close": idx.get("f18"),
                        "volume": idx.get("f5"),
                        "amount": idx.get("f6"),
                    }
                )

            total = data["data"].get("total", 0)
            if len(all_rows) >= total:
                break

            page += 1

        df = pd.DataFrame(all_rows)
        logger.info("Fetched %s indices from Eastmoney", len(df))
        return df

    def fetch_single_stock(
        self,
        symbol: str,
        secid_prefix: str = "1",
    ) -> dict[str, Any] | None:
        """Fetch data for a single stock.

        Args:
            symbol: Stock symbol
            secid_prefix: 1 for SH, 0 for SZ

        Returns:
            Stock data dict or None
        """
        url = (
            f"https://push2.eastmoney.com/api/qt/stock/get?"
            f"secid={secid_prefix}.{symbol}&"
            f"fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f170,f169,f31,f32,f33,f34"
        )

        data = self._make_request(url)

        if data and data.get("data"):
            d = data["data"]
            # Return English field names for compatibility
            return {
                "symbol": d.get("f57"),
                "name": d.get("f58"),
                "price": d.get("f43"),
                "change_percent": d.get("f170"),
                "change": d.get("f169"),
                "volume": d.get("f47"),
                "amount": d.get("f48"),
                "high": d.get("f44"),
                "low": d.get("f45"),
                "open": d.get("f46"),
                "prev_close": d.get("f60"),
                "bid_price": d.get("f31"),
                "bid_volume": d.get("f32"),
                "ask_price": d.get("f33"),
                "ask_volume": d.get("f34"),
            }

        return None

    def fetch_intraday_trends(
        self,
        symbol: str,
        secid_prefix: str = "1",
        ndays: int = 1,
        limit: int = 1200,
    ) -> list[dict] | None:
        """Fetch 1-minute intraday trend data from Eastmoney trends2 API."""
        ndays = max(1, min(ndays, 5))
        url = (
            f"https://push2.eastmoney.com/api/qt/stock/trends2/get?"
            f"fields1=f1,f2,f3,f4,f5,f6,f7,f8&"
            f"fields2=f51,f52,f53,f54,f55,f56,f57,f58&"
            f"ut=7eea3edcaed734bea9cbfc24409ed989&"
            f"iscr=0&ndays={ndays}&secid={secid_prefix}.{symbol}"
        )

        data = self._make_request(url)
        if not data or not data.get("data"):
            logger.warning("No intraday trend data received for %s", symbol)
            return None

        raw_trends = data["data"].get("trends", [])
        if not raw_trends:
            return []

        results: list[dict[str, Any]] = []
        for row in raw_trends[-limit:]:
            parts = row.split(",")
            if len(parts) < 7:
                continue
            try:
                dt = datetime.strptime(parts[0], "%Y-%m-%d %H:%M").replace(
                    tzinfo=ASIA_SHANGHAI_TZ
                )
                results.append(
                    {
                        "timestamp": int(dt.timestamp()),
                        "datetime": parts[0],
                        "open": float(parts[1]),
                        "close": float(parts[2]),
                        "high": float(parts[3]),
                        "low": float(parts[4]),
                        "volume": int(float(parts[5])),
                        "amount": float(parts[6]),
                    }
                )
            except (ValueError, TypeError):
                continue

        logger.info("Fetched %s intraday trend rows for %s", len(results), symbol)
        return results


    def fetch_kline_data(
        self,
        symbol: str,
        secid_prefix: str = "1",
        period: str = "101",  # 101=daily, 102=weekly, 103=monthly
        start_date: str = None,
        end_date: str = None,
        limit: int = 300,
    ) -> list[dict] | None:
        """Fetch K-line historical data from Eastmoney.

        Args:
            symbol: Stock symbol (e.g., '601012')
            secid_prefix: 1 for SH, 0 for SZ
            period: 101=daily, 102=weekly, 103=monthly
            start_date: Start date (YYYYMMDD)
            end_date: End date (YYYYMMDD)
            limit: Maximum number of records

        Returns:
            List of K-line data dictionaries or None
        """
        # Build URL - use push2his.eastmoney.com for historical kline data
        url = (
            f"https://push2his.eastmoney.com/api/qt/stock/kline/get?"
            f"fields1=f1,f2,f3,f4,f5,f6&"
            f"fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116&"
            f"klt={period}&fqt=0&secid={secid_prefix}.{symbol}&"
            f"ut=7eea3edcaed734bea9cbfc24409ed989"
        )

        if start_date:
            url += f"&beg={start_date}"
        if end_date:
            url += f"&end={end_date}"

        logger.debug(f"Fetching kline from Eastmoney: {symbol}, period={period}")

        data = self._make_request(url)

        if not data or not data.get("data"):
            logger.warning(f"No kline data received for {symbol}")
            return None

        raw_klines = data["data"].get("klines", [])
        if not raw_klines:
            return []

        # Parse kline data
        # Format: "date,open,close,high,low,volume,amount,amplitude,pct_change,change_amount,turnover"
        klines = []
        for raw in raw_klines[-limit:]:  # Take last N records
            parts = raw.split(",")
            if len(parts) >= 6:
                date_str = parts[0]
                if " " in date_str:
                    dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M").replace(
                        tzinfo=ASIA_SHANGHAI_TZ
                    )
                else:
                    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(
                        tzinfo=ASIA_SHANGHAI_TZ
                    )
                klines.append({
                    "timestamp": int(dt.timestamp()),
                    "date": date_str,
                    "open": float(parts[1]),
                    "close": float(parts[2]),
                    "high": float(parts[3]),
                    "low": float(parts[4]),
                    "volume": int(float(parts[5])),
                    "amount": float(parts[6]) if len(parts) > 6 else 0,
                    "change_percent": float(parts[8]) if len(parts) > 8 else 0,
                })

        logger.info(f"Fetched {len(klines)} kline records for {symbol}")
        return klines

    def fetch_kline_data_with_preset_cookie(
        self,
        symbol: str,
        secid_prefix: str = "1",
        period: str = "101",
        start_date: str = None,
        end_date: str = None,
        limit: int = 300,
        cookie: str = None,
    ) -> list[dict] | None:
        """Fetch K-line data using a preset cookie (for bypassing network restrictions).

        This method bypasses the normal cookie management and uses the provided
        cookie directly for the request.

        Args:
            symbol: Stock symbol
            secid_prefix: 1 for SH, 0 for SZ
            period: 101=daily, 102=weekly, 103=monthly
            start_date: Start date (YYYYMMDD)
            end_date: End date (YYYYMMDD)
            limit: Maximum number of records
            cookie: Cookie string to use for the request

        Returns:
            List of K-line data dictionaries or None
        """
        if not cookie:
            logger.error("No cookie provided for fetch_kline_data_with_preset_cookie")
            return None

        url = (
            f"https://push2his.eastmoney.com/api/qt/stock/kline/get?"
            f"fields1=f1,f2,f3,f4,f5,f6&"
            f"fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116&"
            f"klt={period}&fqt=0&secid={secid_prefix}.{symbol}&"
            f"ut=7eea3edcaed734bea9cbfc24409ed989"
        )

        if start_date:
            url += f"&beg={start_date}"
        if end_date:
            url += f"&end={end_date}"

        # Build headers with preset cookie
        headers = {
            "User-Agent": random.choice(USER_AGENTS),  # noqa: S311
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Referer": "https://quote.eastmoney.com/",
            "Cookie": cookie,
            "Connection": "keep-alive",
        }

        try:
            req = urllib.request.Request(url, headers=headers, method="GET")  # noqa: S310
            response = urllib.request.urlopen(req, timeout=30)  # noqa: S310
            
            content = response.read()
            encoding = response.headers.get("Content-Encoding", "")
            data = self._decode_json_bytes(content, encoding)
            
            if not data or not data.get("data"):
                logger.warning(f"No kline data received for {symbol}")
                return None

            raw_klines = data["data"].get("klines", [])
            if not raw_klines:
                return []

            klines = []
            for raw in raw_klines[-limit:]:
                parts = raw.split(",")
                if len(parts) >= 6:
                    date_str = parts[0]
                if " " in date_str:
                    dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M").replace(
                        tzinfo=ASIA_SHANGHAI_TZ
                    )
                else:
                    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(
                        tzinfo=ASIA_SHANGHAI_TZ
                    )
                    klines.append({
                        "timestamp": int(dt.timestamp()),
                        "date": date_str,
                        "open": float(parts[1]),
                        "close": float(parts[2]),
                        "high": float(parts[3]),
                        "low": float(parts[4]),
                        "volume": int(float(parts[5])),
                        "amount": float(parts[6]) if len(parts) > 6 else 0,
                        "change_percent": float(parts[8]) if len(parts) > 8 else 0,
                    })

            logger.info(f"Fetched {len(klines)} kline records for {symbol} using preset cookie")
            return klines
            
        except Exception as e:
            logger.error(f"Failed to fetch kline data with preset cookie: {e}")
            return None


# Global client instance
eastmoney_client = EastmoneyClient()
