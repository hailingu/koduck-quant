"""Database access helpers for quant K-line queries."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import psycopg


@dataclass(frozen=True)
class KlineBar:
    """Normalized K-line bar."""

    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


def normalize_symbol(raw: str) -> str:
    """Normalize user-provided symbol to 6-digit A-share symbol."""
    text = (raw or "").strip()
    match = re.search(r"(\d{6})", text)
    if match:
        return match.group(1)
    if text.isdigit():
        return text.zfill(6)
    return text


def get_kline_database_url() -> str:
    """Resolve DB connection URL for K-line queries."""
    return (
        os.getenv("KODUCK_KLINE_DATABASE_URL", "").strip()
        or os.getenv("MEMORY_DATABASE_URL", "").strip()
    )


def _as_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def fetch_kline_bars(
    *,
    market: str,
    symbol: str,
    timeframe: str = "1D",
    limit: int = 260,
) -> list[KlineBar]:
    """Fetch latest K-line bars from `kline_data` and return in ascending order."""
    db_url = get_kline_database_url()
    if not db_url:
        raise ValueError(
            "Kline database URL is not configured. "
            "Set KODUCK_KLINE_DATABASE_URL or MEMORY_DATABASE_URL."
        )

    normalized_symbol = normalize_symbol(symbol)
    if not normalized_symbol:
        return []

    sql = """
        SELECT
            EXTRACT(EPOCH FROM kline_time)::BIGINT AS ts,
            open_price,
            high_price,
            low_price,
            close_price,
            volume,
            amount
        FROM kline_data
        WHERE market = %s
          AND symbol = %s
          AND timeframe = %s
        ORDER BY kline_time DESC
        LIMIT %s
    """

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (market, normalized_symbol, timeframe, int(limit)))
            rows = cur.fetchall()

    bars: list[KlineBar] = []
    for ts, opn, high, low, close, volume, amount in reversed(rows):
        bars.append(
            KlineBar(
                timestamp=int(ts),
                open=_as_float(opn),
                high=_as_float(high),
                low=_as_float(low),
                close=_as_float(close),
                volume=_as_float(volume),
                amount=_as_float(amount),
            )
        )
    return bars
