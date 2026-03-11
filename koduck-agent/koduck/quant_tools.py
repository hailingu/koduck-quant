"""Quant tool definitions and executors for koduck-agent."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_DATA_SERVICE_BASE = "http://data-service:8000"

QUANT_TOOL_DEFS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_quant_signal",
            "description": "Get quant signal based on EMA20/EMA60/MACD for A-share stocks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "A-share symbol, usually 6 digits, e.g. 601012",
                    },
                    "market": {
                        "type": "string",
                        "description": "Market code, default AShare",
                        "default": "AShare",
                    },
                },
                "required": ["symbol"],
            },
        },
    }
]


def _backend_base_url() -> str:
    return os.getenv("DATA_SERVICE_BASE", DEFAULT_DATA_SERVICE_BASE).rstrip("/")


async def execute_tool(name: str, arguments: dict[str, Any]) -> str:
    """Execute one supported tool and return JSON string content."""
    if name == "get_quant_signal":
        return await _get_quant_signal(arguments)
    return json.dumps(
        {"ok": False, "error": f"Unsupported tool: {name}"},
        ensure_ascii=False,
    )


async def _get_quant_signal(arguments: dict[str, Any]) -> str:
    symbol = str(arguments.get("symbol", "")).strip()
    market = str(arguments.get("market", "AShare")).strip() or "AShare"

    if not symbol:
        return json.dumps(
            {"ok": False, "error": "Missing required argument: symbol"},
            ensure_ascii=False,
        )

    base = _backend_base_url()
    timeout = httpx.Timeout(10.0, connect=5.0)
    endpoint = f"{base}/api/v1/a-share/kline"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                endpoint,
                params={
                    "symbol": symbol,
                    "timeframe": "1D",
                    "limit": 260,
                },
            )
    except Exception as e:
        logger.warning("quant tool request failed: %s", e)
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": f"Data service request failed: {e}"},
            ensure_ascii=False,
        )

    if resp.status_code != 200:
        return json.dumps(
            {
                "ok": False,
                "symbol": symbol,
                "error": f"Kline API failed: status={resp.status_code}",
            },
            ensure_ascii=False,
        )

    closes = _extract_close_prices(resp.json())
    if len(closes) < 60:
        return json.dumps(
            {
                "ok": False,
                "symbol": symbol,
                "error": f"Insufficient kline data: {len(closes)} points",
            },
            ensure_ascii=False,
        )

    ema20 = _ema(closes, 20)
    ema60 = _ema(closes, 60)
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    if None in (ema12, ema26):
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": "Failed to compute MACD base values"},
            ensure_ascii=False,
        )
    macd_series = _macd_series(closes)
    if len(macd_series) < 9:
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": "Insufficient MACD series"},
            ensure_ascii=False,
        )
    signal = _ema(macd_series, 9)
    macd = ema12 - ema26
    hist = macd - signal if signal is not None else None

    if None in (ema20, ema60, macd, signal, hist):
        return json.dumps(
            {"ok": False, "symbol": symbol, "error": "Incomplete indicator values"},
            ensure_ascii=False,
        )

    direction = "LONG_BIAS" if float(ema20) >= float(ema60) else "SHORT_BIAS"
    momentum = "MOMENTUM_UP" if float(hist) >= 0 else "MOMENTUM_DOWN"
    if direction == "LONG_BIAS" and momentum == "MOMENTUM_UP":
        action = "BUY_OR_HOLD"
    elif direction == "SHORT_BIAS" and momentum == "MOMENTUM_DOWN":
        action = "REDUCE_OR_WAIT"
    else:
        action = "NEUTRAL_WAIT_CONFIRM"

    return json.dumps(
        {
            "ok": True,
            "symbol": symbol,
            "market": market,
            "indicators": {
                "ema20": round(float(ema20), 4),
                "ema60": round(float(ema60), 4),
                "macd": round(float(macd), 4),
                "signal": round(float(signal), 4),
                "histogram": round(float(hist), 4),
            },
            "signal": {
                "direction": direction,
                "momentum": momentum,
                "action": action,
            },
            "note": "Quant signal is for reference only, not financial advice.",
        },
        ensure_ascii=False,
    )


def _extract_close_prices(payload: dict[str, Any]) -> list[float]:
    # Data-service response shape: {"code":0,"message":"success","data":[{...}]}
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return []
    closes: list[float] = []
    for item in data:
        if isinstance(item, dict) and item.get("close") is not None:
            try:
                closes.append(float(item["close"]))
            except Exception:
                continue
    return closes


def _ema(values: list[float], period: int) -> float | None:
    if period <= 0 or len(values) < period:
        return None
    alpha = 2.0 / (period + 1.0)
    ema_value = sum(values[:period]) / period
    for price in values[period:]:
        ema_value = alpha * price + (1 - alpha) * ema_value
    return ema_value


def _macd_series(closes: list[float]) -> list[float]:
    if len(closes) < 26:
        return []
    ema12 = sum(closes[:12]) / 12.0
    ema26 = sum(closes[:26]) / 26.0
    alpha12 = 2.0 / 13.0
    alpha26 = 2.0 / 27.0
    series: list[float] = []
    for i, price in enumerate(closes):
        if i >= 12:
            ema12 = alpha12 * price + (1 - alpha12) * ema12
        if i >= 26:
            ema26 = alpha26 * price + (1 - alpha26) * ema26
            series.append(ema12 - ema26)
    return series
