"""Update all 1D K-line CSV files to the latest date.

Usage:
    python app/scripts/update_all_kline_1d.py [--dry-run] [--delay 2]
"""

import argparse
import asyncio
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pandas as pd
from app.services.incremental_kline_updater import incremental_kline_updater


DATA_DIR = Path(__file__).parent.parent.parent / "data" / "kline" / "1D"


def get_all_symbols():
    """Get all stock symbols from CSV files."""
    symbols = []
    for csv_file in DATA_DIR.glob("*.csv"):
        symbol = csv_file.stem
        symbols.append(symbol)
    return sorted(symbols)


def get_last_date_from_csv(csv_path):
    """Get the last date from CSV file."""
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        if df.empty:
            return None
        last_timestamp = df['timestamp'].max()
        last_date = datetime.fromtimestamp(last_timestamp)
        return last_date
    except Exception as e:
        print(f"  ⚠️  Error reading {csv_path}: {e}")
        return None


async def update_symbol(symbol, dry_run=False, max_retries=3):
    """Update a single symbol to latest date with retry."""
    csv_path = DATA_DIR / f"{symbol}.csv"
    
    # Get last date from CSV
    last_date = get_last_date_from_csv(csv_path)
    if not last_date:
        print(f"  ⚠️  {symbol}: Cannot determine last date, skipping")
        return None
    
    # Calculate date range
    start_date = (last_date + pd.Timedelta(days=1)).strftime("%Y%m%d")
    end_date = datetime.now().strftime("%Y%m%d")
    
    if start_date > end_date:
        print(f"  ✓  {symbol}: Already up to date (last: {last_date.strftime('%Y-%m-%d')})")
        return None
    
    print(f"  → {symbol}: Updating {start_date} to {end_date} (last: {last_date.strftime('%Y-%m-%d')})")
    
    # Retry logic
    for attempt in range(max_retries):
        try:
            result = await incremental_kline_updater.incremental_update(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                timeframe="1D",
                dry_run=dry_run,
            )
            
            if result.records_added > 0:
                print(f"  ✓  {symbol}: Added {result.records_added} records (CSV: {result.csv_records_added})")
            elif result.records_added == 0 and not dry_run:
                print(f"  -  {symbol}: No new data available")
            
            return result
            
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 2  # 2s, 4s, 6s
                print(f"  ⚠️  {symbol}: Error (attempt {attempt+1}/{max_retries}), retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                print(f"  ✗  {symbol}: Failed after {max_retries} attempts - {e}")
                return None
    
    return None


async def main(dry_run=False, delay=2):
    """Main function to update all symbols."""
    print("=" * 70)
    print("K-line 1D Data Updater")
    print("=" * 70)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE'}")
    print(f"Delay between requests: {delay}s")
    print(f"Data directory: {DATA_DIR}")
    print()
    
    symbols = get_all_symbols()
    print(f"Found {len(symbols)} symbols: {', '.join(symbols)}")
    print()
    
    # Show current status
    print("Current CSV status:")
    print("-" * 70)
    total_behind = 0
    for symbol in symbols:
        csv_path = DATA_DIR / f"{symbol}.csv"
        last_date = get_last_date_from_csv(csv_path)
        if last_date:
            days_behind = (datetime.now() - last_date).days
            total_behind += max(0, days_behind)
            status = f"{days_behind} days behind" if days_behind > 0 else "up to date"
            print(f"  {symbol}: last date {last_date.strftime('%Y-%m-%d')} ({status})")
    print()
    
    # Update all
    print("Starting updates...")
    print("-" * 70)
    
    results = []
    for i, symbol in enumerate(symbols):
        result = await update_symbol(symbol, dry_run)
        results.append((symbol, result))
        
        # Delay between requests to avoid rate limiting
        if i < len(symbols) - 1 and delay > 0:
            await asyncio.sleep(delay)
    
    # Summary
    print()
    print("=" * 70)
    print("Summary")
    print("=" * 70)
    
    total_added = sum(r.records_added for _, r in results if r)
    total_csv_added = sum(r.csv_records_added for _, r in results if r)
    success_count = sum(1 for _, r in results if r and r.records_added >= 0)
    fail_count = sum(1 for _, r in results if r is None)
    
    print(f"Symbols processed: {len(symbols)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total records added to DB: {total_added}")
    print(f"Total records added to CSV: {total_csv_added}")
    print()
    
    if dry_run:
        print("This was a DRY RUN. No actual changes were made.")
        print("Run without --dry-run to apply changes.")
    else:
        print("All updates completed!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update all 1D K-line data to latest")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--delay", type=int, default=2, help="Delay between requests in seconds (default: 2)")
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run, delay=args.delay))
