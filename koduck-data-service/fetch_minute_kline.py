#!/usr/bin/env python3
"""
使用方法2 (AKShare客户端) 获取分钟级K线数据
支持 1m, 15m, 60m
保存到 data/kline/{1m,15m,60m}/ 目录
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd

# 
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.akshare_client import akshare_client

ASIA_SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")

# 
DATA_DIR = project_root / "data" / "kline"
DAILY_DIR = DATA_DIR / "1D"

# 
MINUTE_TIMEFRAMES = {
    "1m": "1",
    "15m": "15",
    "60m": "60",
}


def get_all_daily_symbols():
    """"""
    if not DAILY_DIR.exists():
        print(f": {DAILY_DIR}")
        return []
    
    symbols = []
    for csv_file in DAILY_DIR.glob("*.csv"):
        symbol = csv_file.stem
        symbols.append(symbol)
    
    return sorted(symbols)


def save_to_csv(klines: list[dict], symbol: str, timeframe: str):
    """KCSV"""
    if not klines:
        return 0
    
    # 
    save_dir = DATA_DIR / timeframe
    save_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = save_dir / f"{symbol}.csv"
    
    # DataFrame
    data = []
    for kline in klines:
        local_dt = datetime.fromtimestamp(int(kline["timestamp"]), ASIA_SHANGHAI_TZ)
        data.append({
            "symbol": symbol,
            "datetime": local_dt.strftime("%Y-%m-%d %H:%M"),
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


async def fetch_minute_for_symbol(symbol: str, period: str, limit: int = 300):
    """K"""
    try:
        # 2: AKShare
        klines = await asyncio.to_thread(
            akshare_client.get_kline_minutes,
            symbol=symbol,
            period=period,
            limit=limit
        )
        
        if not klines:
            return None, 0
        
        return klines, len(klines)
        
    except Exception as e:
        print(f"   {symbol} : {e}")
        return None, 0


async def main():
    """"""
    print("=" * 60)
    print("2 (AKShare) K")
    print("=" * 60)
    
    # 
    symbols = get_all_daily_symbols()
    print(f"\n {len(symbols)} : {symbols}")
    
    # 
    total_stats = {}
    
    for timeframe, period in MINUTE_TIMEFRAMES.items():
        print(f"\n{'-' * 60}")
        print(f" {timeframe} (={period}) ")
        print(f"{'-' * 60}")
        
        # 
        tf_dir = DATA_DIR / timeframe
        tf_dir.mkdir(parents=True, exist_ok=True)
        print(f": {tf_dir}")
        
        success_count = 0
        fail_count = 0
        total_records = 0
        
        for i, symbol in enumerate(symbols, 1):
            print(f"\n[{i}/{len(symbols)}]  {symbol}  {timeframe} ...")
            
            klines, count = await fetch_minute_for_symbol(symbol, period, limit=300)
            
            if klines:
                # CSV
                saved_count = save_to_csv(klines, symbol, timeframe)
                
                success_count += 1
                total_records += saved_count
                
                # 
                first_time = datetime.fromtimestamp(klines[0]["timestamp"]).strftime("%Y-%m-%d %H:%M")
                last_time = datetime.fromtimestamp(klines[-1]["timestamp"]).strftime("%Y-%m-%d %H:%M")
                
                print(f"  ✓  {saved_count}  {timeframe} ")
                print(f"    : {first_time} ~ {last_time}")
                print(f"    : {klines[-1]['close']}")
            else:
                fail_count += 1
                print(f"  ✗ ")
            
            # 
            await asyncio.sleep(0.5)
        
        total_stats[timeframe] = {
            "success": success_count,
            "failed": fail_count,
            "records": total_records,
        }
        
        print(f"\n{timeframe} : {success_count} , {fail_count} , {total_records} ")
    
    # 
    print("\n" + "=" * 60)
    print("!")
    print("=" * 60)
    for tf, stats in total_stats.items():
        print(f"  {tf}: {stats['success']} , {stats['records']} ")
    print("=" * 60)
    
    # 
    print("\n:")
    for tf in MINUTE_TIMEFRAMES.keys():
        tf_dir = DATA_DIR / tf
        if tf_dir.exists():
            csv_files = sorted(tf_dir.glob("*.csv"))
            print(f"\n  {tf}/ ({len(csv_files)} ):")
            for csv_file in csv_files:
                size = csv_file.stat().st_size
                print(f"    - {csv_file.name} ({size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
