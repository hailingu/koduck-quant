#!/usr/bin/env python3
""" K  CSV 

基于 backfill_kline.py 修改，支持增量更新本地 CSV 文件。

Usage:
    python -m app.scripts.update_kline_incremental --symbol 601012
    python -m app.scripts.update_kline_incremental --all
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import pandas as pd
import structlog

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.eastmoney_client import eastmoney_client

logger = structlog.get_logger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"


def setup_logging(verbose: bool = False):
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if verbose else logging.INFO,
    )


def get_last_date_from_csv(csv_path: Path) -> Optional[datetime]:
    """ CSV """
    try:
        if not csv_path.exists():
            return None
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        if df.empty:
            return None
        last_timestamp = df['timestamp'].max()
        return datetime.fromtimestamp(last_timestamp)
    except Exception as e:
        logger.warning(f"Failed to read CSV {csv_path}: {e}")
        return None


def merge_and_save_kline(
    existing_data: List[dict],
    new_data: List[dict],
    symbol: str,
    name: str,
    timeframe: str
) -> int:
    """ CSV
    
    Returns:
        新增的记录数
    """
    if not new_data:
        return 0
    
    # 
    all_data = existing_data + new_data
    
    # （ timestamp）
    seen_timestamps = set()
    unique_data = []
    for record in sorted(all_data, key=lambda x: x['timestamp']):
        if record['timestamp'] not in seen_timestamps:
            seen_timestamps.add(record['timestamp'])
            unique_data.append(record)
    
    records_added = len(unique_data) - len(existing_data)
    
    if records_added == 0:
        logger.info(f"No new data for {symbol}")
        return 0
    
    if symbol.isdigit():
        symbol = symbol.zfill(6)

    #  CSV
    tf_dir = DATA_DIR / timeframe
    tf_dir.mkdir(parents=True, exist_ok=True)
    
    df = pd.DataFrame(unique_data)
    df['symbol'] = symbol
    df['name'] = name
    # Keep date aligned with Beijing trading calendar for readability.
    bj = pd.to_datetime(df['timestamp'], unit='s', utc=True).dt.tz_convert('Asia/Shanghai')
    df['datetime'] = bj.dt.normalize().dt.tz_localize(None)
    
    columns = ['symbol', 'name', 'datetime', 'timestamp', 'open', 'high', 'low', 'close', 'volume', 'amount']
    df = df[[col for col in columns if col in df.columns]]
    
    file_path = tf_dir / f"{symbol}.csv"
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    
    logger.info(f"Saved {len(df)} records ({records_added} new) to {file_path}")
    return records_added


async def incremental_update_symbol(
    symbol: str,
    name: str,
    timeframe: str = "1D",
) -> bool:
    """ K """
    csv_path = DATA_DIR / timeframe / f"{symbol}.csv"
    
    #  CSV 
    last_date = get_last_date_from_csv(csv_path)
    
    if last_date:
        start_date = (last_date + timedelta(days=1)).strftime("%Y%m%d")
        logger.info(f"{symbol}: Last date in CSV is {last_date.strftime('%Y-%m-%d')}, fetching from {start_date}")
    else:
        #  CSV， 30 
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y%m%d")
        logger.info(f"{symbol}: No existing CSV, fetching last 30 days from {start_date}")
    
    end_date = datetime.now().strftime("%Y%m%d")
    
    if start_date > end_date:
        logger.info(f"{symbol}: Already up to date")
        return True
    
    try:
        # 
        existing_data = []
        if csv_path.exists():
            df = pd.read_csv(csv_path, encoding='utf-8-sig')
            existing_data = df.to_dict('records')
        
        #  -  Eastmoney 
        period_map = {"1D": "101", "1W": "102", "1M": "103"}  # Eastmoney period codes
        period = period_map.get(timeframe, "101")
        secid_prefix = "1" if symbol.startswith("6") else "0"  # =1, =0
        
        logger.info(f"{symbol}: Fetching data from {start_date} to {end_date}")
        
        new_data = eastmoney_client.fetch_kline_data(
            symbol=symbol,
            secid_prefix=secid_prefix,
            period=period,
            start_date=start_date,
            end_date=end_date,
            limit=1000
        )
        
        if not new_data:
            logger.warning(f"{symbol}: No new data returned")
            return False
        
        #  CSV 
        converted_data = []
        for record in new_data:
            converted_data.append({
                'timestamp': record['timestamp'],
                'open': record['open'],
                'high': record['high'],
                'low': record['low'],
                'close': record['close'],
                'volume': record['volume'],
                'amount': record.get('amount'),
            })
        
        # 
        records_added = merge_and_save_kline(existing_data, converted_data, symbol, name, timeframe)
        
        logger.info(f"{symbol}: Added {records_added} new records")
        return True
        
    except Exception as e:
        logger.error(f"{symbol}: Failed to update - {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    parser = argparse.ArgumentParser(
        description="增量更新 K 线数据到 CSV",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument("--symbol", type=str, help="股票代码，如: 601012")
    parser.add_argument("--all", action="store_true", help="更新所有 CSV 中的股票")
    parser.add_argument("--timeframe", type=str, default="1D", help="时间周期 (默认: 1D)")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细日志")
    
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    # 
    symbols = []
    if args.symbol:
        symbols = [(args.symbol, "")]
    elif args.all:
        #  CSV 
        tf_dir = DATA_DIR / args.timeframe
        if tf_dir.exists():
            for csv_file in tf_dir.glob("*.csv"):
                symbols.append((csv_file.stem, ""))
    else:
        parser.print_help()
        return
    
    if not symbols:
        logger.error("No symbols to update")
        return
    
    logger.info(f"Updating {len(symbols)} symbols with timeframe {args.timeframe}")
    
    success_count = 0
    for symbol, name in symbols:
        success = await incremental_update_symbol(symbol, name, args.timeframe)
        if success:
            success_count += 1
    
    logger.info(f"Update completed: {success_count}/{len(symbols)} succeeded")


if __name__ == "__main__":
    asyncio.run(main())
