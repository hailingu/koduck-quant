#!/usr/bin/env python3
"""K

用于将本地CSV文件中的K线数据导入到PostgreSQL数据库的kline_data表。

Usage:
    python -m app.scripts.import_kline --help
    python -m app.scripts.import_kline --dry-run
    python -m app.scripts.import_kline --timeframes 1D,5m
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

import pandas as pd
import structlog

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.config import settings
from app.db import Database

logger = structlog.get_logger(__name__)

# 
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline"

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


def find_csv_files(timeframes: Optional[List[str]] = None) -> List[Path]:
    """CSV"""
    files = []
    
    if not DATA_DIR.exists():
        logger.warning("Data directory does not exist", data_dir=str(DATA_DIR))
        return files
    
    if timeframes:
        for tf in timeframes:
            tf_dir = get_timeframe_dir(tf)
            if tf_dir.exists():
                csv_files = list(tf_dir.glob("*.csv"))
                files.extend(csv_files)
    else:
        # CSV
        for tf_dir in DATA_DIR.iterdir():
            if tf_dir.is_dir():
                csv_files = list(tf_dir.glob("*.csv"))
                files.extend(csv_files)
    
    return files


def load_csv_data(csv_path: Path) -> Optional[pd.DataFrame]:
    """CSV"""
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        return df
    except Exception as e:
        logger.exception("Failed to load CSV", csv_path=str(csv_path), error=str(e))
        return None


def detect_timeframe(csv_path: Path) -> str:
    """"""
    # : data/kline/{timeframe}/{symbol}.csv
    parts = csv_path.parts
    if 'kline' in parts:
        idx = parts.index('kline')
        if idx + 1 < len(parts):
            return parts[idx + 1]
    return "1D"  # 


def convert_timeframe_to_db(tf: str) -> str:
    """"""
    # 
    # 1D -> 1D, 5m -> 5m
    return tf


def _resolve_symbol(df: pd.DataFrame, csv_path: Path) -> str:
    """Resolve symbol from CSV content or fallback to filename stem."""
    if 'symbol' in df.columns:
        symbols = df['symbol'].unique()
        if len(symbols) > 0:
            return str(symbols[0])
    return csv_path.stem


def _extract_kline_time(row: pd.Series) -> Optional[datetime]:
    """Extract and normalize kline timestamp from one CSV row."""
    if 'datetime' in row:
        return pd.to_datetime(row['datetime'])
    if 'kline_time' in row:
        return pd.to_datetime(row['kline_time'])
    if 'timestamp' in row:
        return datetime.fromtimestamp(row['timestamp'])
    return None


def _build_insert_values(
    row: pd.Series,
    symbol: str,
    db_timeframe: str,
    kline_time: datetime,
) -> tuple[Any, ...]:
    """Build positional SQL values for one kline row."""
    return (
        "AShare",
        symbol,
        db_timeframe,
        kline_time,
        float(row.get('open', 0) or row.get('open_price', 0)),
        float(row.get('high', 0) or row.get('high_price', 0)),
        float(row.get('low', 0) or row.get('low_price', 0)),
        float(row.get('close', 0) or row.get('close_price', 0)),
        int(row.get('volume', 0) or 0),
        float(row.get('amount', 0) or row.get('amount', 0) or 0),
    )


async def _import_rows(
    conn: Any,
    df: pd.DataFrame,
    insert_sql: str,
    symbol: str,
    db_timeframe: str,
) -> tuple[int, int]:
    """Import dataframe rows and return (imported, skipped) counts."""
    imported = 0
    skipped = 0

    for _, row in df.iterrows():
        try:
            kline_time = _extract_kline_time(row)
            if kline_time is None:
                skipped += 1
                continue

            await conn.execute(
                insert_sql,
                *_build_insert_values(row, symbol, db_timeframe, kline_time),
            )
            imported += 1
        except Exception as e:
            logger.warning("Failed to import row", error=str(e))
            skipped += 1

    return imported, skipped


async def import_kline_to_db(
    csv_path: Path,
    dry_run: bool = False,
) -> dict:
    """CSV
    
    Args:
        csv_path: CSV文件路径
        dry_run: 是否为试运行模式
        
    Returns:
        导入结果统计
    """
    result = {
        "file": str(csv_path),
        "success": False,
        "imported": 0,
        "skipped": 0,
        "error": None
    }
    
    # 
    df = load_csv_data(csv_path)
    if df is None or df.empty:
        result["error"] = "Failed to load CSV or empty file"
        logger.warning("Skipping CSV file due to empty or failed load", csv_path=str(csv_path))
        return result
    
    timeframe = detect_timeframe(csv_path)
    symbol = _resolve_symbol(df, csv_path)
    
    logger.info(
        "Importing K-line CSV",
        symbol=symbol,
        timeframe=timeframe,
        records=len(df),
        filename=csv_path.name,
    )
    
    if dry_run:
        result["success"] = True
        result["skipped"] = len(df)
        logger.info("Dry run: skip writing records", symbol=symbol, records=len(df))
        return result
    
    # SQL
    # kline_data:
    # market, symbol, timeframe, kline_time, open_price, high_price, low_price, close_price, volume, amount
    insert_sql = """
        INSERT INTO kline_data (
            market, symbol, timeframe, kline_time,
            open_price, high_price, low_price, close_price,
            volume, amount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (market, symbol, timeframe, kline_time) DO NOTHING
    """
    
    try:
        pool = await Database.get_pool()
        db_timeframe = convert_timeframe_to_db(timeframe)
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                imported, skipped = await _import_rows(
                    conn=conn,
                    df=df,
                    insert_sql=insert_sql,
                    symbol=symbol,
                    db_timeframe=db_timeframe,
                )
        
        result["success"] = True
        result["imported"] = imported
        result["skipped"] = skipped
        logger.info(
            "K-line CSV import completed",
            symbol=symbol,
            timeframe=timeframe,
            imported=imported,
            skipped=skipped,
        )
        
    except Exception as e:
        result["error"] = str(e)
        logger.exception("Failed to import K-line CSV", csv_path=str(csv_path), error=str(e))
    
    return result


async def import_all_kline(
    timeframes: Optional[List[str]] = None,
    dry_run: bool = False,
    symbols: Optional[List[str]] = None,
) -> dict:
    """K
    
    Args:
        timeframes: 要导入的时间周期列表
        dry_run: 是否为试运行
        symbols: 要导入的股票代码列表
        
    Returns:
        导入结果统计
    """
    # CSV
    csv_files = find_csv_files(timeframes)
    
    # ，
    if symbols:
        csv_files = [f for f in csv_files if f.stem in symbols]
    
    if not csv_files:
        logger.warning("No CSV files found to import")
        return {
            "total": 0,
            "success": 0,
            "failed": 0,
            "imported_records": 0,
            "skipped_records": 0,
            "details": []
        }
    
    results = {
        "total": len(csv_files),
        "success": 0,
        "failed": 0,
        "imported_records": 0,
        "skipped_records": 0,
        "details": []
    }
    
    logger.info("Starting K-line batch import", file_count=len(csv_files))
    
    for csv_file in csv_files:
        result = await import_kline_to_db(csv_file, dry_run)
        results["details"].append(result)
        
        if result["success"]:
            results["success"] += 1
            results["imported_records"] += result["imported"]
            results["skipped_records"] += result["skipped"]
        else:
            results["failed"] += 1
    
    return results


async def check_table_exists() -> bool:
    """kline_data"""
    try:
        result = await Database.fetchrow(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'kline_data'
            )
            """
        )
        return result and result.get('exists', False)
    except Exception as e:
        logger.warning("Failed to check table existence", error=str(e))
        return False


async def get_table_stats() -> dict:
    """kline_data"""
    try:
        # 
        total = await Database.fetchrow("SELECT COUNT(*) as count FROM kline_data")
        total_count = total['count'] if total else 0
        
        # 
        by_symbol = await Database.fetch("""
            SELECT symbol, timeframe, COUNT(*) as count 
            FROM kline_data 
            GROUP BY symbol, timeframe 
            ORDER BY symbol, timeframe
        """)
        
        return {
            "total_records": total_count,
            "by_symbol": [dict(row) for row in by_symbol]
        }
    except Exception as e:
        logger.exception("Failed to get table stats", error=str(e))
        return {"total_records": 0, "by_symbol": []}


def _build_parser() -> argparse.ArgumentParser:
    """Build command line argument parser."""
    parser = argparse.ArgumentParser(
        description="K线数据导入工具 - 将本地CSV文件导入数据库",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m app.scripts.import_kline --dry-run
  python -m app.scripts.import_kline --timeframes 1D,5m
  python -m app.scripts.import_kline --symbols 601012
  python -m app.scripts.import_kline --stats
        """,
    )

    parser.add_argument(
        "--timeframes",
        type=str,
        help="时间周期，逗号分隔，如: 1D,5m"
    )
    parser.add_argument(
        "--symbols",
        type=str,
        help="股票代码，逗号分隔，如: 601012,002050"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="试运行模式，不实际写入数据库"
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="显示数据库中现有的K线数据统计"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细日志"
    )
    return parser


def _parse_csv_option(value: Optional[str]) -> Optional[List[str]]:
    """Parse comma separated CLI argument into list."""
    if not value:
        return None
    return [item.strip() for item in value.split(",")]


def _print_stats(stats: dict) -> None:
    """Print kline table stats to console."""
    print("\nK-line Data Statistics:")
    print(f"  Total records: {stats['total_records']}")
    print("\nBy symbol and timeframe:")
    for item in stats['by_symbol']:
        print(f"  {item['symbol']} ({item['timeframe']}): {item['count']} records")


def _print_import_results(results: dict, verbose: bool) -> None:
    """Print final import summary."""
    print("\n!")
    print(f"  : {results['total']}")
    print(f"  : {results['success']}")
    print(f"  : {results['failed']}")
    print(f"  : {results['imported_records']}")
    print(f"  : {results['skipped_records']}")

    if not verbose:
        return

    print("\n:")
    for detail in results['details']:
        status = "✓" if detail['success'] else "✗"
        print(f"  {status} {detail['file']}")
        if detail['error']:
            print(f"      : {detail['error']}")


def _log_import_options(
    timeframes: Optional[List[str]],
    symbols: Optional[List[str]],
    dry_run: bool,
) -> None:
    """Log import options."""
    logger.info(
        "Starting K-line import",
        timeframes=timeframes or ["all"],
        symbols=symbols or ["all"],
        dry_run=dry_run,
    )


async def main():
    """"""
    parser = _build_parser()
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    # 
    logger.info("Initializing database connection...")
    await Database.get_pool()
    
    if not await check_table_exists():
        logger.error("kline_data table does not exist! Please run database migrations first.")
        await Database.close()
        sys.exit(1)
    
    if args.stats:
        _print_stats(await get_table_stats())
        await Database.close()
        return
    
    timeframes = _parse_csv_option(args.timeframes)
    symbols = _parse_csv_option(args.symbols)
    _log_import_options(timeframes, symbols, args.dry_run)
    
    results = await import_all_kline(
        timeframes=timeframes,
        dry_run=args.dry_run,
        symbols=symbols
    )
    _print_import_results(results, args.verbose)
    
    await Database.close()


if __name__ == "__main__":
    asyncio.run(main())
