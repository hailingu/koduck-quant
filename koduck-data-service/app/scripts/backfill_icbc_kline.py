"""
Simplified K-line backfill script for ICBC (601398).
Only fills today and yesterday's data.
"""

import asyncio
import logging
from datetime import datetime, timedelta

import akshare as ak
import pandas as pd
import structlog

import sys
sys.path.insert(0, '/app')

from app.db import Database

logger = structlog.get_logger(__name__)

# ICBC stock code
ICBC_SYMBOL = "601398"
ICBC_MARKET = "AShare"


def _parse_kline_time(date_value):
    """Parse AKShare date value into datetime."""
    if isinstance(date_value, str):
        return datetime.strptime(date_value, "%Y-%m-%d")
    if hasattr(date_value, "date"):
        return date_value
    return datetime.combine(date_value, datetime.min.time())


def _to_float(value):
    """Convert value to float, fallback to 0.0 for NaN/None."""
    return float(value) if pd.notna(value) else 0.0


def _to_int(value):
    """Convert value to int, fallback to 0 for NaN/None."""
    return int(value) if pd.notna(value) else 0


def _build_kline_record(row):
    """Build kline_data-compatible record from one AKShare row."""
    return {
        "market": ICBC_MARKET,
        "symbol": ICBC_SYMBOL,
        "timeframe": "1D",
        "kline_time": _parse_kline_time(row["日期"]),
        "open_price": _to_float(row["开盘"]),
        "high_price": _to_float(row["最高"]),
        "low_price": _to_float(row["最低"]),
        "close_price": _to_float(row["收盘"]),
        "volume": _to_int(row["成交量"]),
        "amount": _to_float(row["成交额"]),
    }


def _transform_kline_dataframe(df: pd.DataFrame):
    """Transform AKShare DataFrame rows into DB insert records."""
    return [_build_kline_record(row) for _, row in df.iterrows()]


async def backfill_icbc_daily_kline():
    """Backfill ICBC daily K-line data for today and yesterday."""
    logger.info("Starting K-line backfill", symbol=ICBC_SYMBOL, lookback_days=2)
    
    try:
        # Calculate date range (yesterday and today)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=5)  # Get 5 days to ensure we have 2 trading days
        
        start_date_str = start_date.strftime("%Y%m%d")
        end_date_str = end_date.strftime("%Y%m%d")
        
        logger.info(
            "Fetching daily K-line",
            symbol=ICBC_SYMBOL,
            start_date=start_date_str,
            end_date=end_date_str,
        )
        
        # Fetch data from AKShare
        df = ak.stock_zh_a_hist(
            symbol=ICBC_SYMBOL,
            period="daily",
            start_date=start_date_str,
            end_date=end_date_str
        )
        
        if df.empty:
            logger.warning("No K-line data found", symbol=ICBC_SYMBOL)
            return
        
        logger.info("Fetched K-line records from AKShare", symbol=ICBC_SYMBOL, records=len(df))

        # Transform data to match kline_data table schema
        records = _transform_kline_dataframe(df)
        
        # Insert into database
        await insert_kline_records(records)
        
        logger.info(
            "Successfully backfilled K-line records",
            symbol=ICBC_SYMBOL,
            records=len(records),
        )
        
    except Exception as e:
        logger.exception("Failed to backfill K-line data", symbol=ICBC_SYMBOL, error=str(e))
        raise


async def insert_kline_records(records):
    """Insert K-line records into database."""
    if not records:
        return
    
    query = """
    INSERT INTO kline_data (
        market, symbol, timeframe, kline_time,
        open_price, high_price, low_price, close_price,
        volume, amount, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (market, symbol, timeframe, kline_time) DO UPDATE SET
        open_price = EXCLUDED.open_price,
        high_price = EXCLUDED.high_price,
        low_price = EXCLUDED.low_price,
        close_price = EXCLUDED.close_price,
        volume = EXCLUDED.volume,
        amount = EXCLUDED.amount,
        updated_at = NOW()
    """
    
    pool = await Database.get_pool()
    async with pool.acquire() as conn:
        for record in records:
            try:
                await conn.execute(
                    query,
                    record['market'],
                    record['symbol'],
                    record['timeframe'],
                    record['kline_time'],
                    record['open_price'],
                    record['high_price'],
                    record['low_price'],
                    record['close_price'],
                    record['volume'],
                    record['amount']
                )
                kline_date = record['kline_time'].date() if hasattr(record['kline_time'], 'date') else record['kline_time']
                logger.debug("Inserted or updated K-line", symbol=record['symbol'], kline_date=str(kline_date))
            except Exception as e:
                logger.exception("Failed to insert K-line record", record=record, error=str(e))
                raise


async def main():
    """Main entry point."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        await backfill_icbc_daily_kline()
        print(f"✅ K-line backfill completed for {ICBC_SYMBOL}")
    except Exception as e:
        print(f"❌ Backfill failed: {e}")
        raise
    finally:
        await Database.close()


if __name__ == "__main__":
    asyncio.run(main())
