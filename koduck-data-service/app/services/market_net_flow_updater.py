"""Daily market net-flow updater.

This service computes A-share daily market net inflow and persists one record
per trading day into market_daily_net_flow.
"""

from __future__ import annotations

import logging
from datetime import datetime, date
from zoneinfo import ZoneInfo

import akshare as ak
import pandas as pd

from app.db import market_net_flow_db

logger = logging.getLogger(__name__)


class MarketNetFlowUpdater:
    """Fetch and persist daily market net-flow aggregates."""

    MARKET = "AShare"
    FLOW_TYPE = "MAIN_FORCE"
    SOURCE = "AKSHARE_MARKET_FUND_FLOW"
    QUALITY = "OFFICIAL"

    def __init__(self) -> None:
        self._tz = ZoneInfo("Asia/Shanghai")

    @staticmethod
    def _pick_net_column(df: pd.DataFrame) -> str | None:
        candidates = [
            "主力净流入-净额",
            "今日主力净流入-净额",
            "今日净流入",
            "主力净流入",
        ]
        for col in candidates:
            if col in df.columns:
                return col
        return None

    @staticmethod
    def _to_number(value) -> float | None:
        num = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
        if pd.isna(num):
            return None
        return float(num)

    async def update_once(self) -> bool:
        """Fetch latest available trading-day market net-flow and upsert to DB."""
        now = datetime.now(self._tz)

        try:
            df_market = ak.stock_market_fund_flow()
        except Exception as e:
            logger.warning("Failed to fetch sector fund flow from AKShare: %s", e)
            return False

        if df_market is None or df_market.empty:
            logger.warning("AKShare returned empty market fund flow dataframe")
            return False

        if "日期" not in df_market.columns:
            logger.warning("AKShare market fund flow missing 日期 column: columns=%s", df_market.columns.tolist())
            return False

        net_col = self._pick_net_column(df_market)
        if not net_col:
            logger.warning(
                "No usable net-flow column found. Available columns=%s",
                df_market.columns.tolist(),
            )
            return False

        df_market = df_market.copy()
        df_market["日期"] = pd.to_datetime(df_market["日期"], errors="coerce").dt.date
        df_market = df_market[df_market["日期"].notna()]
        if df_market.empty:
            logger.warning("AKShare market fund flow has no valid 日期 values")
            return False

        latest_row = df_market.sort_values("日期").iloc[-1]
        trade_date: date = latest_row["日期"]
        net_inflow = self._to_number(latest_row.get(net_col))
        if net_inflow is None:
            logger.warning("Latest row has invalid net inflow value: trade_date=%s col=%s", trade_date, net_col)
            return False

        # We only have net inflow in this upstream table; keep directional totals derived from net.
        total_inflow = max(net_inflow, 0.0)
        total_outflow = max(-net_inflow, 0.0)

        success = await market_net_flow_db.upsert_daily_net_flow(
            market=self.MARKET,
            flow_type=self.FLOW_TYPE,
            trade_date=trade_date,
            net_inflow=net_inflow,
            total_inflow=total_inflow,
            total_outflow=total_outflow,
            source=self.SOURCE,
            quality=self.QUALITY,
            snapshot_time=now.replace(tzinfo=None),
            currency="CNY",
        )

        if success:
            logger.info(
                "Updated market daily net flow: market=%s flow_type=%s trade_date=%s net_inflow=%.2f",
                self.MARKET,
                self.FLOW_TYPE,
                trade_date,
                net_inflow,
            )

        return success


market_net_flow_updater = MarketNetFlowUpdater()
