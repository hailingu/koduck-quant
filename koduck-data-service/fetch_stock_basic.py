#!/usr/bin/env python3
"""
Fetch stock basic data from AKShare and save to CSV.
Similar to fetch_kline_data.py
"""

import asyncio
import sys
from pathlib import Path

# Add project path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.stock_basic_manager import stock_basic_manager


async def main():
    """Main function to fetch and save stock basic data."""
    print("=" * 60)
    print("Stock Basic Data Fetcher")
    print("=" * 60)

    # Fetch from API and save to CSV
    success = await stock_basic_manager.refresh()

    if success:
        print("\n✓ Stock basic data fetched and saved successfully")
        print(f"  CSV location: {stock_basic_manager.csv_file}")
    else:
        print("\n✗ Failed to fetch stock basic data")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
