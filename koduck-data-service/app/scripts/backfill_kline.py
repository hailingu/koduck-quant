#!/usr/bin/env python3
"""K

用于从AKShare获取股票历史K线数据并保存到本地CSV文件。
支持日线和分钟K线数据。

Usage:
    python -m app.scripts.backfill_kline --help
    python -m app.scripts.backfill_kline --symbols 601012,002050 --timeframes 1D,5m
    python -m app.scripts.backfill_kline --all --timeframes 1D
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

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.akshare_client import AKShareClient

logger = structlog.get_logger(__name__)

# 
DEFAULT_STOCKS = [
    ("601012", "隆基绿能"),
    ("002050", "三花智控"),
    ("601137", "华钰矿业"),
    ("601919", "中远海控"),
    ("002885", "京泉华"),
    ("002326", "永太科技"),
    ("002156", "通富微电"),
]

# 
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def setup_logging(verbose: bool = False):
    """"""
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


def get_timeframe_dir(timeframe: str) -> Path:
    """"""
    return DATA_DIR / timeframe


def save_kline_to_csv(data: List[dict], symbol: str, name: str, timeframe: str) -> Path:
    """Save k-line data to a CSV file.

    Args:
        data: List of k-line records retrieved from AKShare.
        symbol: Stock symbol associated with the data.
        name: Stock name (display purposes only).
        timeframe: Timeframe string such as ``"1D"`` or ``"5m"``.

    Returns:
        Path to the CSV file where data was written. If there was no data,
        ``None`` is returned and no file is created.
    """
    if not data:
        logger.warning(f"No data to save for {symbol} ({timeframe})")
        return None
    
    # 
    tf_dir = get_timeframe_dir(timeframe)
    tf_dir.mkdir(parents=True, exist_ok=True)
    
    # DataFrame
    df = pd.DataFrame(data)
    
    # 
    df['symbol'] = symbol
    df['name'] = name
    
    # 
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
    
    # 
    columns = ['symbol', 'name', 'datetime', 'timestamp', 'open', 'high', 'low', 'close', 'volume', 'amount']
    df = df[[col for col in columns if col in df.columns]]
    
    # CSV
    file_path = tf_dir / f"{symbol}.csv"
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    
    logger.info(f"Saved {len(df)} records to {file_path}")
    return file_path


async def fetch_and_save_kline(
    client: AKShareClient,
    symbol: str,
    name: str,
    timeframe: str,
    days: int = 730,  # 2
) -> bool:
    """Fetch k-line data from AKShare and write it to CSV.

    A wrapper that calls the appropriate AKShareClient method based on the
    timeframe (daily vs. minute data), then delegates to :func:`save_kline_to_csv`.

    Args:
        client: Initialized :class:`AKShareClient` instance.
        symbol: Stock symbol to fetch.
        name: Stock name for metadata.
        timeframe: Timeframe string (e.g. ``"1D"``, ``"5m"``).
        days: Number of days worth of daily data to retrieve (only used for
            daily timeframes).

    Returns:
        ``True`` if data was successfully fetched and saved; ``False``
        otherwise.
    """
    try:
        logger.info(f"Fetching {timeframe} data for {symbol} ({name})...")
        
        # 
        if timeframe.endswith('m'):  # K
            minute_period = timeframe.replace('m', '')
            limit = 500  # K
            data = client.get_kline_minutes(symbol, period=minute_period, limit=limit)
        else:  # K
            # 
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
            
            period_map = {
                "1D": "daily",
                "1W": "weekly", 
                "1M": "monthly"
            }
            period = period_map.get(timeframe, "daily")
            
            data = client.get_kline_data(
                symbol=symbol,
                period=period,
                start_date=start_date,
                end_date=end_date,
                limit=1000
            )
        
        if not data:
            logger.warning(f"No data returned for {symbol} ({timeframe})")
            return False
        
        # CSV
        file_path = save_kline_to_csv(data, symbol, name, timeframe)
        
        if file_path:
            logger.info(f"Successfully saved {symbol} ({timeframe}): {len(data)} records")
            return True
        return False
        
    except Exception as e:
        logger.error(f"Failed to fetch {symbol} ({timeframe}): {e}")
        return False


async def backfill_kline_data(
    symbols: Optional[List[str]] = None,
    timeframes: Optional[List[str]] = None,
    days: int = 730,
) -> dict:
    """Main routine for backfilling k-line data for multiple symbols/timeframes.

    The function iterates over the Cartesian product of symbols and
    timeframes, fetches the corresponding data via ``fetch_and_save_kline`` and
    aggregates success/failure counts.

    Args:
        symbols: Optional list of stock symbols. If ``None`` the
            :data:`DEFAULT_STOCKS` list is used.
        timeframes: Optional list of timeframe strings. If ``None`` defaults to
            ``["1D", "5m"]``.
        days: Number of days of historical daily data to request when fetching
            daily timeframes.

    Returns:
        A dictionary containing keys ``success``, ``failed`` and ``details``
        describing the outcome of each individual fetch attempt.
    """
    client = AKShareClient()
    
    # 
    stock_list = DEFAULT_STOCKS
    if symbols:
        stock_list = [(s, "") for s in symbols]  # ，
    
    # 
    if timeframes is None:
        timeframes = ["1D", "5m"]
    
    # 
    valid_timeframes = ["1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"]
    timeframes = [t for t in timeframes if t in valid_timeframes]
    
    if not timeframes:
        logger.error("No valid timeframes specified")
        return {"success": 0, "failed": 0}
    
    results = {
        "success": 0,
        "failed": 0,
        "details": []
    }
    
    total = len(stock_list) * len(timeframes)
    logger.info(f"Starting backfill: {len(stock_list)} stocks × {len(timeframes)} timeframes = {total} tasks")
    
    for symbol, name in stock_list:
        for timeframe in timeframes:
            success = await fetch_and_save_kline(client, symbol, name, timeframe, days)
            if success:
                results["success"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "symbol": symbol,
                "timeframe": timeframe,
                "success": success
            })
    
    return results


def list_saved_data() -> dict:
    """List k-line files that have already been saved locally.

    Scans the ``DATA_DIR`` directory structure and returns a mapping of
    timeframe names to counts and filenames of the CSV files present.

    Returns:
        A dictionary with keys ``data_dir`` (string) and ``timeframes`` which
        is itself a dict mapping timeframe to a dict with ``count`` and
        ``files``.
    """
    info = {
        "data_dir": str(DATA_DIR),
        "timeframes": {}
    }
    
    for tf_dir in DATA_DIR.iterdir():
        if tf_dir.is_dir():
            csv_files = list(tf_dir.glob("*.csv"))
            info["timeframes"][tf_dir.name] = {
                "count": len(csv_files),
                "files": [f.stem for f in csv_files]
            }
    
    return info


async def main():
    """Command‑line entry point for the backfill script.

    Parses arguments, configures logging, and either lists existing data or
    triggers ``backfill_kline_data`` based on the supplied options.  Results
    are printed to stdout.
    """
    parser = argparse.ArgumentParser(
        description="K线数据回填工具 - 从AKShare获取股票历史K线数据",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m app.scripts.backfill_kline --symbols 601012 --timeframes 1D
  python -m app.scripts.backfill_kline --all --timeframes 1D,5m
  python -m app.scripts.backfill_kline --list
  python -m app.scripts.backfill_kline --days 365 --timeframes 1D
        """
    )
    
    parser.add_argument(
        "--symbols", 
        type=str,
        help="股票代码，逗号分隔，如: 601012,002050"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="使用默认股票列表"
    )
    parser.add_argument(
        "--timeframes",
        type=str,
        default="1D,5m",
        help="时间周期，逗号分隔，如: 1D,5m,15m (默认: 1D,5m)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=730,
        help="日K线获取的天数 (默认: 730)"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="列出已保存的K线数据"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细日志"
    )
    
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    # 
    if args.list:
        info = list_saved_data()
        print(f"\n: {info['data_dir']}")
        print("\n:")
        for tf, data in info['timeframes'].items():
            print(f"  {tf}: {data['count']} ")
            print(f"    {', '.join(data['files'])}")
        return
    
    # 
    symbols = None
    if args.symbols:
        symbols = [s.strip() for s in args.symbols.split(",")]
    elif args.all:
        symbols = None  # 
    
    timeframes = [t.strip() for t in args.timeframes.split(",")]
    
    # 
    logger.info(f"Starting K-line backfill...")
    logger.info(f"  Symbols: {symbols or 'default list'}")
    logger.info(f"  Timeframes: {timeframes}")
    logger.info(f"  Days: {args.days}")
    
    results = await backfill_kline_data(
        symbols=symbols,
        timeframes=timeframes,
        days=args.days
    )
    
    print(f"\n!")
    print(f"  : {results['success']}")
    print(f"  : {results['failed']}")
    
    # 
    if args.verbose:
        print("\n:")
        for detail in results['details']:
            status = "✓" if detail['success'] else "✗"
            print(f"  {status} {detail['symbol']} - {detail['timeframe']}")


if __name__ == "__main__":
    asyncio.run(main())
