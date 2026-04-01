#!/usr/bin/env python3
"""Rebuild minute-level K-line CSV files with the new minute data pipeline.

This script overwrites minute timeframe CSV files under ``data/kline`` using
the current AKShareClient minute fetch logic (with Eastmoney trends fallback).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import structlog

from app.services.akshare_client import akshare_client

logger = structlog.get_logger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"
MINUTE_TIMEFRAMES = ["1m", "5m", "15m", "30m", "60m"]


def parse_csv_option(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def discover_symbols() -> list[str]:
    symbols: set[str] = set()
    if not DATA_DIR.exists():
        return []

    for tf_dir in DATA_DIR.iterdir():
        if not tf_dir.is_dir():
            continue
        for csv_path in tf_dir.glob("*.csv"):
            stem = csv_path.stem.strip()
            if stem.isdigit():
                symbols.add(stem.zfill(6))

    return sorted(symbols)


def build_dataframe(symbol: str, bars: list[dict]) -> pd.DataFrame:
    rows: list[dict] = []
    for bar in bars:
        ts = int(bar.get("timestamp", 0) or 0)
        if ts <= 0:
            continue
        dt = pd.to_datetime(ts, unit="s", utc=True).tz_convert("Asia/Shanghai")
        rows.append(
            {
                "symbol": symbol,
                "name": "",
                "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
                "timestamp": ts,
                "open": float(bar.get("open", 0) or 0),
                "high": float(bar.get("high", 0) or 0),
                "low": float(bar.get("low", 0) or 0),
                "close": float(bar.get("close", 0) or 0),
                "volume": int(bar.get("volume", 0) or 0),
                "amount": float(bar.get("amount", 0) or 0),
            }
        )

    if not rows:
        return pd.DataFrame(
            columns=[
                "symbol",
                "name",
                "datetime",
                "timestamp",
                "open",
                "high",
                "low",
                "close",
                "volume",
                "amount",
            ]
        )

    df = pd.DataFrame(rows)
    return df.drop_duplicates(subset=["timestamp"], keep="last").sort_values("timestamp")


def rebuild_symbol_timeframe(symbol: str, timeframe: str, limit: int) -> tuple[int, Path]:
    period = timeframe.replace("m", "")
    bars = akshare_client.get_kline_minutes(symbol=symbol, period=period, limit=limit)
    df = build_dataframe(symbol, bars)

    tf_dir = DATA_DIR / timeframe
    tf_dir.mkdir(parents=True, exist_ok=True)
    csv_path = tf_dir / f"{symbol}.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    return len(df), csv_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rebuild minute K-line CSV files with new minute data pipeline."
    )
    parser.add_argument(
        "--symbols",
        type=str,
        help="Comma-separated symbols, e.g. 601012,002326. Default: auto-discover from data/kline",
    )
    parser.add_argument(
        "--timeframes",
        type=str,
        default="1m,5m,15m,30m,60m",
        help="Comma-separated minute timeframes. Default: 1m,5m,15m,30m,60m",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1500,
        help="Max bars requested per timeframe (default: 1500)",
    )
    args = parser.parse_args()

    symbols = parse_csv_option(args.symbols) or discover_symbols()
    if not symbols:
        logger.warning("No symbols found, nothing to rebuild")
        return 0

    requested_tfs = parse_csv_option(args.timeframes) or MINUTE_TIMEFRAMES
    timeframes = [tf for tf in requested_tfs if tf in MINUTE_TIMEFRAMES]
    if not timeframes:
        logger.error("No valid minute timeframes provided")
        return 1

    logger.info(
        "Starting minute CSV rebuild",
        symbols=len(symbols),
        timeframes=timeframes,
        limit=args.limit,
    )

    failed = 0
    for symbol in symbols:
        for timeframe in timeframes:
            try:
                count, csv_path = rebuild_symbol_timeframe(symbol, timeframe, args.limit)
                logger.info(
                    "Rebuilt minute CSV",
                    symbol=symbol,
                    timeframe=timeframe,
                    rows=count,
                    file=str(csv_path),
                )
            except Exception as exc:
                failed += 1
                logger.error(
                    "Failed rebuilding minute CSV",
                    symbol=symbol,
                    timeframe=timeframe,
                    error=str(exc),
                )

    if failed:
        logger.warning("Minute CSV rebuild completed with failures", failed=failed)
        return 1

    logger.info("Minute CSV rebuild completed successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
