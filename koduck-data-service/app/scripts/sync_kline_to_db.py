#!/usr/bin/env python3
"""同步本地 CSV K-line 数据到数据库

在 CSV 文件更新后运行此脚本，将新数据同步到 PostgreSQL。

Usage:
    python -m app.scripts.sync_kline_to_db          # 同步所有 CSV
    python -m app.scripts.sync_kline_to_db --symbol 601012  # 同步指定股票
    python -m app.scripts.sync_kline_to_db --force  # 强制重新导入
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

import structlog

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db import Database
from app.services.kline_sync import kline_sync

logger = structlog.get_logger(__name__)


def setup_logging(verbose: bool = False):
    """配置日志"""
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


def parse_csv_option(value: str | None) -> list[str] | None:
    """Parse comma separated string to list."""
    if not value:
        return None
    return [item.strip() for item in value.split(",")]


async def main():
    parser = argparse.ArgumentParser(
        description="同步本地 CSV K-line 数据到 PostgreSQL 数据库",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m app.scripts.sync_kline_to_db                    # 同步所有
  python -m app.scripts.sync_kline_to_db --symbol 601012    # 同步指定股票
  python -m app.scripts.sync_kline_to_db --timeframes 1D    # 同步指定周期
  python -m app.scripts.sync_kline_to_db --force            # 强制重新导入
        """,
    )
    
    parser.add_argument(
        "--symbol",
        type=str,
        help="股票代码，如: 601012"
    )
    parser.add_argument(
        "--symbols",
        type=str,
        help="多个股票代码，逗号分隔，如: 601012,002050"
    )
    parser.add_argument(
        "--timeframes",
        type=str,
        help="时间周期，逗号分隔，如: 1D,5m"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制重新导入，即使数据已存在"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细日志"
    )
    
    args = parser.parse_args()
    setup_logging(args.verbose)
    
    # 初始化数据库连接
    logger.info("Initializing database connection...")
    await Database.get_pool()
    
    # 确定要同步的股票
    symbols = None
    if args.symbol:
        symbols = [args.symbol]
    elif args.symbols:
        symbols = parse_csv_option(args.symbols)
    
    timeframes = parse_csv_option(args.timeframes)
    
    logger.info(
        "Starting K-line sync",
        symbols=symbols or "all",
        timeframes=timeframes or "all",
        force=args.force,
    )
    
    # 执行同步
    results = await kline_sync.sync_all(
        timeframes=timeframes,
        symbols=symbols,
        force=args.force,
    )
    
    # 打印结果
    print("\n" + "=" * 60)
    print("同步完成!")
    print(f"  总文件数: {results['total']}")
    print(f"  成功: {results['success']}")
    print(f"  失败: {results['failed']}")
    print(f"  导入记录: {results['imported']}")
    print(f"  跳过记录: {results['skipped']}")
    
    if args.verbose and results['details']:
        print("\n详细结果:")
        for detail in results['details']:
            status = "✓" if detail['success'] else "✗"
            print(f"  {status} {detail['symbol']} ({detail['timeframe']}): "
                  f"导入 {detail['imported']}, 跳过 {detail['skipped']}")
            if detail['error']:
                print(f"      错误: {detail['error']}")
    
    await Database.close()
    
    # 如果有失败，返回非零退出码
    return 0 if results['failed'] == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
