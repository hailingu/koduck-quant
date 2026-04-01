"""Daily market breadth updater.

Fetches A-share breadth summary and persists one record per trading day into
market_daily_breadth.
"""

from __future__ import annotations

import logging
from datetime import datetime, date
from zoneinfo import ZoneInfo

import akshare as ak
import pandas as pd

from app.db import market_breadth_db

logger = logging.getLogger(__name__)


class MarketBreadthUpdater:
    """Fetch and persist daily market breadth aggregates."""

    MARKET = "AShare"
    BREADTH_TYPE = "ALL_A"
    SOURCE = "AKSHARE_MARKET_ACTIVITY_LEGU"
    QUALITY = "OFFICIAL"

    def __init__(self) -> None:
        self._tz = ZoneInfo("Asia/Shanghai")

    @staticmethod
    def _to_number(value) -> float | None:
        num = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
        if pd.isna(num):
            return None
        return float(num)

    async def update_once(self) -> bool:
        """Fetch latest available market breadth and upsert to DB."""
        now = datetime.now(self._tz)
        try:
            df = ak.stock_market_activity_legu()
        except Exception as e:
            logger.warning("Failed to fetch market breadth from AKShare: %s", e)
            return False

        if df is None or df.empty:
            logger.warning("AKShare returned empty market breadth dataframe")
            return False

        # Expected shape: columns item/value, with rows like 上涨/下跌/平盘/停牌/统计日期
        mapping = {}
        for _, row in df.iterrows():
            item = str(row.get("item", "")).strip()
            mapping[item] = row.get("value")

        gainers = self._to_number(mapping.get("上涨"))
        losers = self._to_number(mapping.get("下跌"))
        unchanged = self._to_number(mapping.get("平盘")) or 0.0
        suspended = self._to_number(mapping.get("停牌"))
        stat_time_raw = mapping.get("统计日期")

        if gainers is None or losers is None:
            logger.warning("Missing gainers/losers from market breadth row map: keys=%s", list(mapping.keys()))
            return False

        trade_date: date
        try:
            parsed = pd.to_datetime(stat_time_raw, errors="coerce")
            if pd.isna(parsed):
                trade_date = now.date()
            else:
                trade_date = parsed.date()
        except Exception:
            trade_date = now.date()

        gainers_i = int(gainers)
        losers_i = int(losers)
        unchanged_i = int(unchanged)
        suspended_i = int(suspended) if suspended is not None else None
        total_stocks = gainers_i + losers_i + unchanged_i
        advance_decline_line = gainers_i - losers_i

        success = await market_breadth_db.upsert_daily_breadth(
            market=self.MARKET,
            breadth_type=self.BREADTH_TYPE,
            trade_date=trade_date,
            gainers=gainers_i,
            losers=losers_i,
            unchanged=unchanged_i,
            suspended=suspended_i,
            total_stocks=total_stocks,
            advance_decline_line=advance_decline_line,
            source=self.SOURCE,
            quality=self.QUALITY,
            snapshot_time=now.replace(tzinfo=None),
        )
        if success:
            logger.info(
                "Updated market daily breadth: market=%s breadth_type=%s trade_date=%s gainers=%s losers=%s",
                self.MARKET,
                self.BREADTH_TYPE,
                trade_date,
                gainers_i,
                losers_i,
            )
        return success


market_breadth_updater = MarketBreadthUpdater()
