"""Tests for data updater helpers."""

import asyncio
from typing import Any

import pytest

from app.services.data_updater import DataUpdater


@pytest.mark.parametrize(
    ("symbol", "expected"),
    [
        ("601012", "1"),
        ("510300", "1"),
        ("002885", "0"),
        ("300750", "0"),
        ("920077", "0"),
        ("830799", "0"),
    ],
)
def test_resolve_secid_prefix(symbol: str, expected: str) -> None:
    """Should map Shanghai symbols to prefix 1 and SZ/BJ symbols to 0."""
    assert DataUpdater._resolve_secid_prefix(symbol) == expected


def test_should_persist_tick_returns_false_outside_trading_hours(monkeypatch: Any) -> None:
    """Must not persist tick outside A-share trading hours."""
    updater = DataUpdater()

    def fake_is_trading_time() -> bool:
        return False

    async def fail_if_called(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError("watchlist check should not run outside trading hours")

    monkeypatch.setattr("app.services.data_updater.is_a_share_trading_time", fake_is_trading_time)
    monkeypatch.setattr("app.services.data_updater.Database.fetchrow", fail_if_called)

    assert asyncio.run(updater._should_persist_tick("601398")) is False


def test_should_persist_tick_returns_false_when_symbol_not_in_watchlist(monkeypatch: Any) -> None:
    """Must not persist tick when symbol is not in watchlist."""
    updater = DataUpdater()

    def fake_is_trading_time() -> bool:
        return True

    async def fake_fetchrow(*_args: Any, **_kwargs: Any) -> Any:
        return None

    monkeypatch.setattr("app.services.data_updater.is_a_share_trading_time", fake_is_trading_time)
    monkeypatch.setattr("app.services.data_updater.Database.fetchrow", fake_fetchrow)

    assert asyncio.run(updater._should_persist_tick("601398")) is False


def test_should_persist_tick_returns_true_when_trading_and_in_watchlist(monkeypatch: Any) -> None:
    """Persist tick only when trading and symbol exists in watchlist."""
    updater = DataUpdater()

    def fake_is_trading_time() -> bool:
        return True

    async def fake_fetchrow(*_args: Any, **_kwargs: Any) -> Any:
        return {"exists": 1}

    monkeypatch.setattr("app.services.data_updater.is_a_share_trading_time", fake_is_trading_time)
    monkeypatch.setattr("app.services.data_updater.Database.fetchrow", fake_fetchrow)
    monkeypatch.setattr(updater, "_should_store_tick", lambda: True)

    assert asyncio.run(updater._should_persist_tick("601398")) is True


def test_save_tick_history_skips_buffer_when_guard_fails(monkeypatch: Any) -> None:
    """Tick buffer should not change when persistence guard returns False."""
    updater = DataUpdater()

    async def fake_should_persist_tick(_symbol: str) -> bool:
        return False

    monkeypatch.setattr(updater, "_should_persist_tick", fake_should_persist_tick)

    payload = {"symbol": "601398", "price": 5.12}
    result = asyncio.run(updater._save_tick_history(payload))

    assert result is True
    assert updater._tick_history_count == 0
    assert updater._tick_buffer == []


def test_update_single_stock_reuses_existing_realtime_outside_trading_hours(
    monkeypatch: Any,
) -> None:
    """Outside trading hours, existing realtime row should be reused directly."""
    updater = DataUpdater()

    def fake_is_trading_time() -> bool:
        return False

    async def fake_get_stock(_symbol: str) -> dict[str, Any]:
        return {"symbol": "601398", "price": 5.12, "name": "ICBC"}

    def fail_fetch_single_stock(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError("provider fetch should not run when realtime already exists")

    monkeypatch.setattr("app.services.data_updater.is_a_share_trading_time", fake_is_trading_time)
    monkeypatch.setattr("app.services.data_updater.stock_db.get_stock", fake_get_stock)
    monkeypatch.setattr(
        "app.services.data_updater.eastmoney_client.fetch_single_stock",
        fail_fetch_single_stock,
    )

    result = asyncio.run(updater.update_single_stock("601398"))

    assert result is not None
    assert result["symbol"] == "601398"
    assert result["price"] == 5.12


def test_apply_cached_daily_change_preserves_upstream_prev_close(monkeypatch: Any) -> None:
    """When upstream provides valid prev_close, do not override it with cache."""
    updater = DataUpdater()

    async def fake_cached_prev_close(_symbol: str) -> float:
        return 18.81

    monkeypatch.setattr(updater, "_get_prev_close_from_daily_cache", fake_cached_prev_close)

    payload: dict[str, Any] = {
        "symbol": "601012",
        "price": 18.99,
        "prev_close": 19.04,
    }

    asyncio.run(updater._apply_cached_daily_change("601012", payload))

    assert payload["prev_close"] == pytest.approx(19.04)
    assert payload["change"] == pytest.approx(-0.05, abs=1e-8)
    assert payload["change_percent"] == pytest.approx(-0.05 / 19.04, abs=1e-8)


def test_apply_cached_daily_change_uses_cache_when_prev_close_missing(monkeypatch: Any) -> None:
    """If upstream prev_close is missing, fallback to cached daily prev_close."""
    updater = DataUpdater()

    async def fake_cached_prev_close(_symbol: str) -> float:
        return 19.04

    monkeypatch.setattr(updater, "_get_prev_close_from_daily_cache", fake_cached_prev_close)

    payload: dict[str, Any] = {
        "symbol": "601012",
        "price": 18.99,
    }

    asyncio.run(updater._apply_cached_daily_change("601012", payload))

    assert payload["prev_close"] == pytest.approx(19.04)
    assert payload["change"] == pytest.approx(-0.05, abs=1e-8)
    assert payload["change_percent"] == pytest.approx(-0.05 / 19.04, abs=1e-8)
