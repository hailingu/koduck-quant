#!/usr/bin/env python3
"""
将 CSV 文件中的 K 线数据导入到 PostgreSQL 数据库的 kline_data 表中。
支持日线(1D)、周线(1W)、月线(1M)数据导入。
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

# 
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 
DATA_DIR = project_root / "data" / "kline"


async def import_csv_to_db(csv_path: Path, dry_run: bool = False):
    """ CSV """
    from app.db import Database
    
    result = {
        "file": str(csv_path),
        "success": False,
        "imported": 0,
        "skipped": 0,
        "error": None
    }
    
    #  CSV
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
    except Exception as e:
        result["error"] = f"读取 CSV 失败: {e}"
        return result
    
    if df.empty:
        result["error"] = "CSV 文件为空"
        return result
    
    # 
    symbol = csv_path.stem
    timeframe = csv_path.parent.name
    
    print(f"   {symbol} ({timeframe}): {len(df)} ...")
    
    if dry_run:
        result["success"] = True
        result["skipped"] = len(df)
        return result
    
    #  SQL
    insert_sql = """
        INSERT INTO kline_data (
            market, symbol, timeframe, kline_time,
            open_price, high_price, low_price, close_price,
            volume, amount, pre_close_price, is_suspended,
            created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        )
        ON CONFLICT (market, symbol, timeframe, kline_time) DO NOTHING
    """
    
    try:
        pool = await Database.get_pool()
        imported = 0
        skipped = 0
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                for _, row in df.iterrows():
                    try:
                        # 
                        if 'datetime' in row:
                            kline_time = pd.to_datetime(row['datetime'])
                        elif 'timestamp' in row:
                            kline_time = datetime.fromtimestamp(row['timestamp'])
                        else:
                            skipped += 1
                            continue

                        check_time = kline_time.to_pydatetime() if isinstance(kline_time, pd.Timestamp) else kline_time
                        if timeframe in {'1D', '1W', '1M'}:
                            if (
                                check_time.hour != 0
                                or check_time.minute != 0
                                or check_time.second != 0
                                or check_time.microsecond != 0
                            ):
                                skipped += 1
                                continue
                        
                        await conn.execute(
                            insert_sql,
                            "AShare",                           # market
                            symbol,                             # symbol
                            timeframe,                          # timeframe
                            kline_time,                         # kline_time
                            float(row.get('open', 0)),          # open_price
                            float(row.get('high', 0)),          # high_price
                            float(row.get('low', 0)),           # low_price
                            float(row.get('close', 0)),         # close_price
                            int(row.get('volume', 0)),          # volume
                            float(row.get('amount', 0)),        # amount
                            (
                                float(row.get('pre_close_price', row.get('preClose')))
                                if row.get('pre_close_price', row.get('preClose')) is not None
                                else None
                            ),
                            str(
                                row.get('is_suspended', row.get('suspendFlag', 0))
                            ).strip().lower() in {"1", "true", "t", "yes", "y"},
                        )
                        imported += 1
                    except Exception as e:
                        print(f"    : {e}")
                        skipped += 1
        
        result["success"] = True
        result["imported"] = imported
        result["skipped"] = skipped
        
    except Exception as e:
        result["error"] = str(e)
        print(f"  : {e}")
    
    return result


async def import_all_timeframes(timeframes: list[str] = None, dry_run: bool = False):
    """"""
    from app.db import Database
    
    if timeframes is None:
        timeframes = ["1D", "1W", "1M"]
    
    print("=" * 60)
    print("K  CSV ")
    print("=" * 60)
    
    # 
    print("\n...")
    try:
        await Database.get_pool()
        print("  ✓ ")
    except Exception as e:
        print(f"  ✗ : {e}")
        return
    
    # 
    try:
        result = await Database.fetchrow("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'kline_data'
            )
        """)
        if not result or not result.get('exists', False):
            print("  ✗ kline_data ，")
            return
        print("  ✓ kline_data ")
    except Exception as e:
        print(f"  ✗ : {e}")
        return
    
    # 
    total_stats = {
        "files": 0,
        "success": 0,
        "failed": 0,
        "imported": 0,
        "skipped": 0,
    }
    
    # 
    for timeframe in timeframes:
        tf_dir = DATA_DIR / timeframe
        if not tf_dir.exists():
            print(f"\n {timeframe}: ")
            continue
        
        csv_files = list(tf_dir.glob("*.csv"))
        if not csv_files:
            print(f"\n {timeframe}:  CSV ")
            continue
        
        print(f"\n{'-' * 60}")
        print(f" {timeframe}  ({len(csv_files)} )")
        print(f"{'-' * 60}")
        
        for csv_file in sorted(csv_files):
            total_stats["files"] += 1
            result = await import_csv_to_db(csv_file, dry_run)
            
            if result["success"]:
                total_stats["success"] += 1
                total_stats["imported"] += result["imported"]
                total_stats["skipped"] += result["skipped"]
                print(f"    ✓  {result['imported']} ,  {result['skipped']} ")
            else:
                total_stats["failed"] += 1
                print(f"    ✗ : {result['error']}")
    
    # 
    await Database.close()
    
    # 
    print("\n" + "=" * 60)
    print("!")
    print(f"  : {total_stats['files']}")
    print(f"  : {total_stats['success']}")
    print(f"  : {total_stats['failed']}")
    print(f"  : {total_stats['imported']}")
    print(f"  : {total_stats['skipped']}")
    print("=" * 60)


async def show_db_stats():
    """ K """
    from app.db import Database
    
    print("\n" + "=" * 60)
    print(" K ")
    print("=" * 60)
    
    try:
        await Database.get_pool()
        
        # 
        total = await Database.fetchrow("SELECT COUNT(*) as count FROM kline_data")
        total_count = total['count'] if total else 0
        print(f"\n: {total_count}")
        
        # 
        rows = await Database.fetch("""
            SELECT symbol, timeframe, COUNT(*) as count 
            FROM kline_data 
            GROUP BY symbol, timeframe 
            ORDER BY symbol, timeframe
        """)
        
        if rows:
            print("\n:")
            print(f"{'':<10} {'':<6} {'':<10}")
            print("-" * 30)
            for row in rows:
                print(f"{row['symbol']:<10} {row['timeframe']:<6} {row['count']:<10}")
        else:
            print("\n K ")
        
        await Database.close()
        
    except Exception as e:
        print(f": {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="将 CSV K 线数据导入数据库")
    parser.add_argument("--timeframes", type=str, help="时间周期，逗号分隔，如: 1D,1W,1M")
    parser.add_argument("--dry-run", action="store_true", help="试运行模式，不实际写入")
    parser.add_argument("--stats", action="store_true", help="显示数据库统计")
    
    args = parser.parse_args()
    
    if args.stats:
        asyncio.run(show_db_stats())
    else:
        timeframes = None
        if args.timeframes:
            timeframes = [t.strip() for t in args.timeframes.split(",")]
        asyncio.run(import_all_timeframes(timeframes, args.dry_run))
