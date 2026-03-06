"""Eastmoney API client with browser simulation and automatic cookie management."""

import gzip
import json
import logging
import random
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from threading import Lock
from typing import Any

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
            "Accept-Encoding": "gzip, deflate, br",
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

    def _refresh_cookie(self) -> bool:
        """Obtain a fresh session cookie from Eastmoney.

        A GET request is issued against the public quote page.  Any ``Set-Cookie``
        headers returned by the server are concatenated and stored along with a
        timestamp so that subsequent calls can decide whether the cookie has
        expired.

        Returns:
            ``True`` if one or more cookies were successfully captured; ``False``
            otherwise (including network errors).
        """
        try:
            # Visit the main quote page to get fresh cookies
            url = QUOTE_PAGE_URL

            req = urllib.request.Request(url, method="GET")  # noqa: S310
            req.add_header("User-Agent", random.choice(USER_AGENTS))  # noqa: S311
            req.add_header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            req.add_header("Accept-Language", "zh-CN,zh;q=0.9")

            response = urllib.request.urlopen(  # noqa: S310
                req,
                timeout=30,
            )

            # Extract cookies from response
            cookies = response.headers.get_all("Set-Cookie")
            if cookies:
                # Parse and store cookies
                cookie_parts = []
                for cookie in cookies:
                    # Extract cookie name=value part (before ;)
                    part = cookie.split(";")[0].strip()
                    if part:
                        cookie_parts.append(part)

                if cookie_parts:
                    with self._state_lock:
                        self._cookie = "; ".join(cookie_parts)
                        self._cookie_timestamp = datetime.now(UTC)
                    logger.info(
                        "Cookie refreshed with %s cookies",
                        len(cookie_parts),
                    )
                    return True

            logger.warning("No cookies received from main page")
            return False

        except (urllib.error.URLError, TimeoutError) as error:
            logger.warning("Failed to refresh cookie: %s", error, exc_info=True)
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
        if (
            cookie is None
            or cookie_timestamp is None
            or (now - cookie_timestamp).total_seconds() >= self._cookie_ttl_seconds
        ):
            return self._refresh_cookie()

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
    def _decode_json_response(response: Any) -> dict[str, Any] | None:
        """Read an HTTP response and decode JSON content.

        Args:
            response: Object returned by ``urllib.request.urlopen``.

        Returns:
            Parsed JSON dictionary on success, or ``None`` if the payload could
            not be decoded or was not a JSON object.
        """
        content = response.read()
        encoding = response.headers.get("Content-Encoding", "")
        if "gzip" in encoding:
            content = gzip.decompress(content)

        data = json.loads(content.decode("utf-8"))
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


# Global client instance
eastmoney_client = EastmoneyClient()
