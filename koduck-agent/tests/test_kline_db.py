"""Tests for kline_db helpers."""

from __future__ import annotations

from koduck import kline_db


def test_normalize_symbol_extracts_six_digits() -> None:
    assert kline_db.normalize_symbol("sz002326") == "002326"
    assert kline_db.normalize_symbol("002326.SZ") == "002326"
    assert kline_db.normalize_symbol("2326") == "002326"


def test_get_kline_database_url_prefers_dedicated_env(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("MEMORY_DATABASE_URL", "postgresql://mem")
    monkeypatch.setenv("KODUCK_KLINE_DATABASE_URL", "postgresql://kline")
    assert kline_db.get_kline_database_url() == "postgresql://kline"


def test_get_kline_database_url_fallback_memory(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.delenv("KODUCK_KLINE_DATABASE_URL", raising=False)
    monkeypatch.setenv("MEMORY_DATABASE_URL", "postgresql://mem")
    assert kline_db.get_kline_database_url() == "postgresql://mem"

