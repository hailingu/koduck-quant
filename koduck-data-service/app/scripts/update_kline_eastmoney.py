#!/usr/bin/env python3
"""使用 Eastmoney 客户端增量更新 K 线数据到 CSV 文件

Usage:
    python -m app.scripts.update_kline_eastmoney --symbol 601012
    python -m app.scripts.update_kline_eastmoney --all
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import pandas as pd
import structlog

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db import Database
from app.services.eastmoney_client import eastmoney_client
from app.services.kline_sync import kline_sync

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
    """从 CSV 文件获取最后日期"""
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
    """合并新旧数据并保存到 CSV
    
    Returns:
        新增的记录数
    """
    if not new_data:
        return 0
    
    # 合并数据
    all_data = existing_data + new_data
    
    # 去重（按 timestamp）
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
    
    # 保存到 CSV
    tf_dir = DATA_DIR / timeframe
    tf_dir.mkdir(parents=True, exist_ok=True)
    
    df = pd.DataFrame(unique_data)
    df['symbol'] = symbol
    df['name'] = name
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
    
    columns = ['symbol', 'name', 'datetime', 'timestamp', 'open', 'high', 'low', 'close', 'volume', 'amount']
    df = df[[col for col in columns if col in df.columns]]
    
    file_path = tf_dir / f"{symbol}.csv"
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    
    logger.info(f"Saved {len(df)} records ({records_added} new) to {file_path}")
    return records_added


def incremental_update_symbol(
    symbol: str,
    name: str,
    timeframe: str = "1D",
) -> bool:
    """增量更新单个股票的 K 线数据"""
    csv_path = DATA_DIR / timeframe / f"{symbol}.csv"
    
    # 获取 CSV 中的最后日期
    last_date = get_last_date_from_csv(csv_path)
    
    if last_date:
        start_date = (last_date + timedelta(days=1)).strftime("%Y%m%d")
        logger.info(f"{symbol}: Last date in CSV is {last_date.strftime('%Y-%m-%d')}, fetching from {start_date}")
    else:
        # 如果没有 CSV，获取最近 30 天
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y%m%d")
        logger.info(f"{symbol}: No existing CSV, fetching last 30 days from {start_date}")
    
    end_date = datetime.now().strftime("%Y%m%d")
    
    if start_date > end_date:
        logger.info(f"{symbol}: Already up to date")
        return True
    
    try:
        # 获取现有数据
        existing_data = []
        if csv_path.exists():
            df = pd.read_csv(csv_path, encoding='utf-8-sig')
            existing_data = df.to_dict('records')
        
        # 获取新数据 - 使用 Eastmoney 客户端
        period_map = {"1D": "101", "1W": "102", "1M": "103"}  # Eastmoney period codes
        period = period_map.get(timeframe, "101")
        secid_prefix = "1" if symbol.startswith("6") else "0"  # 上海=1, 深圳=0
        
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
        
        # 转换数据格式以兼容现有 CSV 格式
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
        
        # 合并并保存
        records_added = merge_and_save_kline(existing_data, converted_data, symbol, name, timeframe)
        
        logger.info(f"{symbol}: Added {records_added} new records")
        return True
        
    except Exception as e:
        logger.error(f"{symbol}: Failed to update - {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="使用 Eastmoney 客户端增量更新 K 线数据到 CSV",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument("--symbol", type=str, help="股票代码，如: 601012")
    parser.add_argument("--all", action="store_true", help="更新所有 CSV 中的股票")
    parser.add_argument("--timeframe", type=str, default="1D", help="时间周期 (默认: 1D)")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细日志")
    
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    # 确定要更新的股票
    symbols = []
    if args.symbol:
        symbols = [(args.symbol, "")]
    elif args.all:
        # 获取所有 CSV 文件中的股票
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
    
    updated_symbols = []
    for symbol, name in symbols:
        success = incremental_update_symbol(symbol, name, args.timeframe)
        if success:
            updated_symbols.append(symbol)
    
    logger.info(f"Update completed: {len(updated_symbols)}/{len(symbols)} succeeded")
    
    # Sync to database if any CSV was updated
    if updated_symbols:
        logger.info("Syncing updated CSV files to database...")
        try:
            # Initialize database connection
            asyncio.run(Database.get_pool())
            
            # Sync updated symbols
            sync_results = asyncio.run(kline_sync.sync_all(
                timeframes=[args.timeframe],
                symbols=updated_symbols,
            ))
            
            logger.info(
                "Database sync completed",
                imported=sync_results['imported'],
                skipped=sync_results['skipped'],
            )
            
            asyncio.run(Database.close())
        except Exception as e:
            logger.error(f"Failed to sync to database: {e}")


if __name__ == "__main__":
    main()
