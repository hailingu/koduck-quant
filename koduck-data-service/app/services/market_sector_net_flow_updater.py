"""Sector-level market net-flow updater.

Fetches AKShare sector net-flow ranking data (industry/concept/region) and
upserts snapshots into market_sector_net_flow.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, date
from zoneinfo import ZoneInfo

import akshare as ak
import pandas as pd

from app.db import market_sector_net_flow_db

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SectorSource:
    ak_sector_type: str
    sector_type: str


class MarketSectorNetFlowUpdater:
    """Fetch and persist sector-level net-flow snapshots."""

    MARKET = "AShare"
    INDICATOR = "TODAY"
    SOURCE = "AKSHARE_STOCK_SECTOR_FUND_FLOW_RANK"
    QUALITY = "OFFICIAL"
    SOURCES = (
        SectorSource("行业资金流", "industry"),
        SectorSource("概念资金流", "concept"),
        SectorSource("地域资金流", "region"),
    )

    def __init__(self) -> None:
        self._tz = ZoneInfo("Asia/Shanghai")

    @staticmethod
    def _to_number(value) -> float | None:
        num = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
        if pd.isna(num):
            return None
        return float(num)

    @staticmethod
    def _pick_value(row: pd.Series, *candidates: str) -> float | None:
        for col in candidates:
            if col in row:
                num = MarketSectorNetFlowUpdater._to_number(row.get(col))
                if num is not None:
                    return num
        return None

    async def _upsert_df(self, df: pd.DataFrame, sector_type: str, trade_date: date, snapshot_time: datetime) -> int:
        if df is None or df.empty:
            return 0

        success_count = 0
        for _, row in df.iterrows():
            sector_name = str(row.get("名称", "")).strip()
            if not sector_name:
                continue

            main_force_net = self._pick_value(row, "今日主力净流入-净额", "主力净流入-净额") or 0.0
            super_big_net = self._pick_value(row, "今日超大单净流入-净额", "超大单净流入-净额")
            big_net = self._pick_value(row, "今日大单净流入-净额", "大单净流入-净额")
            medium_net = self._pick_value(row, "今日中单净流入-净额", "中单净流入-净额")
            small_net = self._pick_value(row, "今日小单净流入-净额", "小单净流入-净额")
            change_pct = self._pick_value(row, "今日涨跌幅", "涨跌幅")
            retail_net = (medium_net or 0.0) + (small_net or 0.0)

            ok = await market_sector_net_flow_db.upsert_sector_net_flow(
                market=self.MARKET,
                indicator=self.INDICATOR,
                trade_date=trade_date,
                sector_type=sector_type,
                sector_name=sector_name,
                main_force_net=main_force_net,
                retail_net=retail_net,
                super_big_net=super_big_net,
                big_net=big_net,
                medium_net=medium_net,
                small_net=small_net,
                change_pct=change_pct,
                source=self.SOURCE,
                quality=self.QUALITY,
                snapshot_time=snapshot_time,
            )
            if ok:
                success_count += 1

        return success_count

    async def update_once(self) -> bool:
        """Fetch and persist latest sector net-flow snapshots."""
        now = datetime.now(self._tz)
        snapshot_time = now.replace(tzinfo=None)
        trade_date = now.date()
        total = 0

        for source in self.SOURCES:
            try:
                df = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type=source.ak_sector_type)
            except Exception as e:
                logger.warning("Failed to fetch sector net flow from AKShare: sector_type=%s error=%s", source.ak_sector_type, e)
                continue

            written = await self._upsert_df(
                df=df,
                sector_type=source.sector_type,
                trade_date=trade_date,
                snapshot_time=snapshot_time,
            )
            total += written
            logger.info("Sector net-flow upsert completed: sector_type=%s rows=%s", source.sector_type, written)

        logger.info("Market sector net-flow update done: trade_date=%s total_rows=%s", trade_date, total)
        return total > 0


market_sector_net_flow_updater = MarketSectorNetFlowUpdater()
