#!/usr/bin/env python3
"""Command-line tool for fetching 1-minute K-line data.

This script provides a CLI for the Minute1KlineTool, allowing users to:
- Fetch historical 1-minute K-line data
- Perform incremental updates
- Check data status and continuity
- Validate cached data

Examples:
    # Fetch last 7 days of 1-minute data for a stock
    python fetch_1m_kline.py update 002326 --days-back 7

    # Check data status
    python fetch_1m_kline.py status 002326

    # Fetch specific date range
    python fetch_1m_kline.py history 002326 --start-date 2024-01-01 --end-date 2024-01-05

    # Dry run (preview what would be fetched)
    python fetch_1m_kline.py update 002326 --days-back 3 --dry-run
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.services.kline_1m import Minute1KlineTool, minute1_kline_tool

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def print_progress(current: int, total: int, message: str) -> None:
    """Print progress updates."""
    percentage = (current / total * 100) if total > 0 else 0
    bar_length = 30
    filled = int(bar_length * current / total) if total > 0 else bar_length
    bar = "█" * filled + "░" * (bar_length - filled)
    print(f"\r[{bar}] {percentage:.1f}% | {message}", end="", flush=True)
    if current >= total:
        print()  # New line when complete


async def cmd_update(args: argparse.Namespace) -> int:
    """Handle the 'update' command for incremental updates."""
    symbol = args.symbol
    days_back = args.days_back
    dry_run = args.dry_run

    print(f"Updating 1-minute K-line data for {symbol}")
    print(f"  Days back: {days_back}")
    print(f"  Dry run: {dry_run}")
    print()

    # Create tool with progress callback
    tool = Minute1KlineTool(progress_callback=print_progress)

    try:
        result = await tool.incremental_update(
            symbol=symbol,
            days_back=days_back,
            dry_run=dry_run,
        )

        print()
        print("Update Results:")
        print(f"  Symbol: {result.symbol}")
        print(f"  Records added to DB: {result.records_added}")
        print(f"  Records added to CSV: {result.csv_records_added}")
        print(f"  Date range: {result.date_range['start']} to {result.date_range['end']}")
        print(f"  Trading days: {result.trading_days}")

        if dry_run:
            print("\n⚠️  Dry run mode - no data was actually saved")

        return 0

    except Exception as e:
        logger.error(f"Update failed: {e}")
        return 1


async def cmd_status(args: argparse.Namespace) -> int:
    """Handle the 'status' command for checking data status."""
    symbol = args.symbol

    print(f"Checking 1-minute K-line data status for {symbol}")
    print()

    tool = minute1_kline_tool

    # Get local data range
    local_min, local_max = tool._get_local_data_range(symbol)

    if local_min is None or local_max is None:
        print(f"No cached data found for {symbol}")
        print(f"\nRun the following command to fetch data:")
        print(f"  python fetch_1m_kline.py update {symbol} --days-back 7")
        return 0

    # Validate data continuity
    validation = tool.validate_data_continuity(symbol)

    print("Data Status:")
    print(f"  Symbol: {symbol}")
    print(f"  Local data range:")
    print(f"    From: {local_min.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"    To:   {local_max.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Total records: {validation['total_records']}")
    print(f"  Is continuous: {'✅ Yes' if validation['is_continuous'] else '❌ No'}")
    print(f"  Gap count: {validation['gap_count']}")

    if validation['gaps']:
        print("\nDetected Gaps:")
        for i, gap in enumerate(validation['gaps'][:5], 1):
            print(f"  {i}. {gap['start']} to {gap['end']}")
        if len(validation['gaps']) > 5:
            print(f"  ... and {len(validation['gaps']) - 5} more gaps")

    print(f"\nLast validated: {validation['validation_time']}")
    return 0


async def cmd_history(args: argparse.Namespace) -> int:
    """Handle the 'history' command for fetching historical data."""
    symbol = args.symbol
    start_date = args.start_date
    end_date = args.end_date or datetime.now().strftime("%Y-%m-%d")

    print(f"Fetching historical 1-minute K-line data for {symbol}")
    print(f"  Start date: {start_date}")
    print(f"  End date: {end_date}")
    print()

    # Create tool with progress callback
    tool = Minute1KlineTool(progress_callback=print_progress)

    try:
        result = tool.get_history(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            save_to_cache=not args.no_cache,
        )

        print()
        print("Fetch Results:")
        print(f"  Symbol: {result.symbol}")
        print(f"  Records fetched: {result.records_added}")
        print(f"  Records saved to CSV: {result.csv_records_added}")
        print(f"  Date range: {result.date_range['start']} to {result.date_range['end']}")
        print(f"  Trading days: {result.trading_days}")

        if args.show_data and result.data:
            print("\nSample data (first 5 records):")
            for record in result.data[:5]:
                dt = datetime.fromtimestamp(record['timestamp'])
                print(f"  {dt.strftime('%Y-%m-%d %H:%M')} - "
                      f"O:{record['open']:.2f} H:{record['high']:.2f} "
                      f"L:{record['low']:.2f} C:{record['close']:.2f}")

        return 0

    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        return 1


async def cmd_gaps(args: argparse.Namespace) -> int:
    """Handle the 'gaps' command for detecting data gaps."""
    symbol = args.symbol
    start_date = args.start_date
    end_date = args.end_date

    print(f"Detecting data gaps for {symbol}")
    print()

    tool = minute1_kline_tool

    gaps = tool.detect_gaps(symbol, start_date, end_date)

    if not gaps:
        print("✅ No gaps detected in the data range")
        return 0

    print(f"❌ Found {len(gaps)} gap(s):")
    print()

    for i, gap in enumerate(gaps, 1):
        duration = gap.end - gap.start
        hours, remainder = divmod(duration.total_seconds(), 3600)
        minutes = remainder // 60
        print(f"  {i}. {gap.start.strftime('%Y-%m-%d %H:%M')} to "
              f"{gap.end.strftime('%Y-%m-%d %H:%M')}")
        print(f"     Duration: {int(hours)}h {int(minutes)}m")
        print()

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="1-minute K-line data fetcher and manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s update 002326 --days-back 7
  %(prog)s status 002326
  %(prog)s history 002326 --start-date 2024-01-01 --end-date 2024-01-05
  %(prog)s gaps 002326
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Update command
    update_parser = subparsers.add_parser(
        "update",
        help="Incrementally update 1-minute K-line data",
    )
    update_parser.add_argument("symbol", help="Stock symbol (e.g., 002326)")
    update_parser.add_argument(
        "--days-back",
        type=int,
        default=7,
        help="Number of days to look back (default: 7, max: 30)",
    )
    update_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be updated without saving",
    )
    update_parser.set_defaults(func=cmd_update)

    # Status command
    status_parser = subparsers.add_parser(
        "status",
        help="Check data status and continuity",
    )
    status_parser.add_argument("symbol", help="Stock symbol (e.g., 002326)")
    status_parser.set_defaults(func=cmd_status)

    # History command
    history_parser = subparsers.add_parser(
        "history",
        help="Fetch historical data for a specific date range",
    )
    history_parser.add_argument("symbol", help="Stock symbol (e.g., 002326)")
    history_parser.add_argument(
        "--start-date",
        required=True,
        help="Start date (YYYY-MM-DD)",
    )
    history_parser.add_argument(
        "--end-date",
        help="End date (YYYY-MM-DD, default: today)",
    )
    history_parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Don't save to CSV cache",
    )
    history_parser.add_argument(
        "--show-data",
        action="store_true",
        help="Display sample data",
    )
    history_parser.set_defaults(func=cmd_history)

    # Gaps command
    gaps_parser = subparsers.add_parser(
        "gaps",
        help="Detect data gaps",
    )
    gaps_parser.add_argument("symbol", help="Stock symbol (e.g., 002326)")
    gaps_parser.add_argument(
        "--start-date",
        help="Start date for gap detection (YYYY-MM-DD)",
    )
    gaps_parser.add_argument(
        "--end-date",
        help="End date for gap detection (YYYY-MM-DD)",
    )
    gaps_parser.set_defaults(func=cmd_gaps)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Run the async command
    return asyncio.run(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
