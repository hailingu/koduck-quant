"""Unit tests for stock initializer."""

import asyncio
from typing import Any

import pandas as pd

from app.services.stock_initializer import (
    StockBasicRecord,
    StockInitializer,
    classify_stock,
)


def test_classify_stock_returns_expected_market_and_board() -> None:
    """Classify common A-share symbols correctly."""
    assert classify_stock("600000") == ("SSE", "Main")
    assert classify_stock("688001") == ("SSE", "STAR")
    assert classify_stock("000001") == ("SZSE", "Main")
    assert classify_stock("300001") == ("SZSE", "ChiNext")


def test_classify_stock_returns_unknown_for_invalid_symbol() -> None:
    """Return unknown classification for invalid symbol input."""
    assert classify_stock("not-a-code") == ("Unknown", "Unknown")


def test_fetch_with_retry_eventually_succeeds(monkeypatch: Any) -> None:
    """Retry on empty responses and return non-empty DataFrame later."""
    initializer = StockInitializer()
    initializer._api_max_retries = 3
    initializer._api_retry_base_delay = 1

    attempts = 0
    sleep_calls = 0

    async def fake_sleep(_delay: int) -> None:
        nonlocal sleep_calls
        sleep_calls += 1

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    def fake_fetch() -> pd.DataFrame:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            return pd.DataFrame(columns=["code", "name"])
        return pd.DataFrame([{"code": "600000", "name": "浦发银行"}])

    result = asyncio.run(initializer._fetch_with_retry(fake_fetch))

    assert result is not None
    assert len(result) == 1
    assert sleep_calls == 2


def test_fetch_a_share_stocks_uses_method_one_result(monkeypatch: Any) -> None:
    """Return processed stocks when first data source succeeds."""
    initializer = StockInitializer()

    async def fake_fetch_with_retry(*_args: Any, **_kwargs: Any) -> pd.DataFrame | None:
        return pd.DataFrame([{"code": "600000", "name": "浦发银行"}])

    processed: list[StockBasicRecord] = [
        {
            "symbol": "600000",
            "name": "浦发银行",
            "market": "SSE",
            "board": "Main",
            "created_at": pd.Timestamp("2026-01-01").to_pydatetime(),
            "updated_at": pd.Timestamp("2026-01-01").to_pydatetime(),
        }
    ]

    monkeypatch.setattr(initializer, "_fetch_with_retry", fake_fetch_with_retry)
    monkeypatch.setattr(initializer, "_process_stock_data", lambda _df: processed)

    result = asyncio.run(initializer.fetch_a_share_stocks())

    assert result == processed


def test_fetch_a_share_stocks_returns_empty_when_all_methods_fail(
    monkeypatch: Any,
) -> None:
    """Return empty list when all upstream stock list providers fail."""
    initializer = StockInitializer()

    async def fake_fetch_with_retry(*_args: Any, **_kwargs: Any) -> pd.DataFrame | None:
        return None

    monkeypatch.setattr(initializer, "_fetch_with_retry", fake_fetch_with_retry)

    result = asyncio.run(initializer.fetch_a_share_stocks())

    assert result == []
