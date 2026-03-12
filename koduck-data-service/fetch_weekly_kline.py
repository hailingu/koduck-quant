#!/usr/bin/env python3
"""
使用方法2 (AKShare客户端) 获取周线数据
从现有的日线数据股票列表获取对应的周线数据
保存到 data/kline/1W/ 目录
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# 
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.akshare_client import akshare_client

# 
DATA_DIR = project_root / "data" / "kline"
DAILY_DIR = DATA_DIR / "1D"
WEEKLY_DIR = DATA_DIR / "1W"


def get_all_daily_symbols():
    """"""
    if not DAILY_DIR.exists():
        print(f": {DAILY_DIR}")
        return []
    
    symbols = []
    for csv_file in DAILY_DIR.glob("*.csv"):
        symbol = csv_file.stem  #  .csv 
        symbols.append(symbol)
    
    return sorted(symbols)


def save_to_csv(klines: list[dict], symbol: str, timeframe: str = "1W"):
    """KCSV"""
    import pandas as pd
    
    if not klines:
        return 0
    
    # 
    save_dir = DATA_DIR / timeframe
    save_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = save_dir / f"{symbol}.csv"
    
    # DataFrame
    data = []
    for kline in klines:
        data.append({
            "symbol": symbol,
            "datetime": datetime.fromtimestamp(kline["timestamp"]).strftime("%Y-%m-%d"),
            "timestamp": kline["timestamp"],
            "open": kline.get("open", 0),
            "high": kline.get("high", 0),
            "low": kline.get("low", 0),
            "close": kline.get("close", 0),
            "volume": kline.get("volume", 0),
            "amount": kline.get("amount", 0),
        })
    
    df = pd.DataFrame(data)
    df = df.sort_values(by="timestamp", ascending=True)
    
    # CSV
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    
    return len(df)


async def fetch_weekly_for_symbol(symbol: str, limit: int = 500):
    """"""
    try:
        # 2: AKShare
        klines = await asyncio.to_thread(
            akshare_client.get_kline_data,
            symbol=symbol,
            period="weekly",  # 
            limit=limit
        )
        
        if not klines:
            return None, 0
        
        # CSV
        count = save_to_csv(klines, symbol, "1W")
        
        return klines, count
        
    except Exception as e:
        print(f"   {symbol} : {e}")
        return None, 0


async def main():
    """"""
    print("=" * 60)
    print("2 (AKShare) ")
    print("=" * 60)
    
    # 
    symbols = get_all_daily_symbols()
    print(f"\n {len(symbols)} : {symbols}")
    
    # 
    WEEKLY_DIR.mkdir(parents=True, exist_ok=True)
    print(f": {WEEKLY_DIR}")
    
    # 
    success_count = 0
    fail_count = 0
    total_records = 0
    
    print("\n" + "-" * 60)
    print("...")
    print("-" * 60)
    
    for i, symbol in enumerate(symbols, 1):
        print(f"\n[{i}/{len(symbols)}]  {symbol} ...")
        
        klines, count = await fetch_weekly_for_symbol(symbol)
        
        if klines:
            success_count += 1
            total_records += count
            
            # 
            first_date = datetime.fromtimestamp(klines[0]["timestamp"]).strftime("%Y-%m-%d")
            last_date = datetime.fromtimestamp(klines[-1]["timestamp"]).strftime("%Y-%m-%d")
            
            print(f"  ✓  {count} ")
            print(f"    : {first_date} ~ {last_date}")
            print(f"    : {klines[-1]['close']}")
        else:
            fail_count += 1
            print(f"  ✗ ")
        
        # 
        await asyncio.sleep(0.5)
    
    # 
    print("\n" + "=" * 60)
    print("!")
    print(f"  : {success_count} ")
    print(f"  : {fail_count} ")
    print(f"  : {total_records} ")
    print(f"  : {WEEKLY_DIR}")
    print("=" * 60)
    
    # 
    print("\n:")
    for csv_file in sorted(WEEKLY_DIR.glob("*.csv")):
        size = csv_file.stat().st_size
        print(f"  - {csv_file.name} ({size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
