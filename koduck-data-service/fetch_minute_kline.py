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

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.akshare_client import akshare_client

ASIA_SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")

# 数据目录
DATA_DIR = project_root / "data" / "kline"
DAILY_DIR = DATA_DIR / "1D"

# 分钟周期配置
MINUTE_TIMEFRAMES = {
    "1m": "1",
    "15m": "15",
    "60m": "60",
}


def get_all_daily_symbols():
    """获取所有有日线数据的股票代码"""
    if not DAILY_DIR.exists():
        print(f"日线数据目录不存在: {DAILY_DIR}")
        return []
    
    symbols = []
    for csv_file in DAILY_DIR.glob("*.csv"):
        symbol = csv_file.stem
        symbols.append(symbol)
    
    return sorted(symbols)


def save_to_csv(klines: list[dict], symbol: str, timeframe: str):
    """将K线数据保存到CSV文件"""
    if not klines:
        return 0
    
    # 构建目录
    save_dir = DATA_DIR / timeframe
    save_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = save_dir / f"{symbol}.csv"
    
    # 转换为DataFrame
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
    
    # 保存到CSV
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    
    return len(df)


async def fetch_minute_for_symbol(symbol: str, period: str, limit: int = 300):
    """获取单只股票的分钟级K线数据"""
    try:
        # 使用方法2: AKShare客户端获取分钟数据
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
        print(f"  获取 {symbol} 分钟数据失败: {e}")
        return None, 0


async def main():
    """主函数"""
    print("=" * 60)
    print("使用方法2 (AKShare客户端) 获取分钟级K线数据")
    print("=" * 60)
    
    # 获取所有日线股票列表
    symbols = get_all_daily_symbols()
    print(f"\n发现 {len(symbols)} 只日线数据股票: {symbols}")
    
    # 统计
    total_stats = {}
    
    for timeframe, period in MINUTE_TIMEFRAMES.items():
        print(f"\n{'-' * 60}")
        print(f"获取 {timeframe} (周期={period}) 数据")
        print(f"{'-' * 60}")
        
        # 创建目录
        tf_dir = DATA_DIR / timeframe
        tf_dir.mkdir(parents=True, exist_ok=True)
        print(f"保存目录: {tf_dir}")
        
        success_count = 0
        fail_count = 0
        total_records = 0
        
        for i, symbol in enumerate(symbols, 1):
            print(f"\n[{i}/{len(symbols)}] 正在获取 {symbol} 的 {timeframe} 数据...")
            
            klines, count = await fetch_minute_for_symbol(symbol, period, limit=300)
            
            if klines:
                # 保存到CSV
                saved_count = save_to_csv(klines, symbol, timeframe)
                
                success_count += 1
                total_records += saved_count
                
                # 显示数据范围
                first_time = datetime.fromtimestamp(klines[0]["timestamp"]).strftime("%Y-%m-%d %H:%M")
                last_time = datetime.fromtimestamp(klines[-1]["timestamp"]).strftime("%Y-%m-%d %H:%M")
                
                print(f"  ✓ 成功获取 {saved_count} 条 {timeframe} 数据")
                print(f"    数据范围: {first_time} ~ {last_time}")
                print(f"    最新收盘: {klines[-1]['close']}")
            else:
                fail_count += 1
                print(f"  ✗ 获取失败或暂无数据")
            
            # 添加小延迟避免请求过快
            await asyncio.sleep(0.5)
        
        total_stats[timeframe] = {
            "success": success_count,
            "failed": fail_count,
            "records": total_records,
        }
        
        print(f"\n{timeframe} 获取完成: {success_count} 成功, {fail_count} 失败, {total_records} 条记录")
    
    # 汇总
    print("\n" + "=" * 60)
    print("所有分钟级数据获取完成!")
    print("=" * 60)
    for tf, stats in total_stats.items():
        print(f"  {tf}: {stats['success']} 只股票, {stats['records']} 条记录")
    print("=" * 60)
    
    # 列出保存的文件
    print("\n已保存的分钟级数据文件:")
    for tf in MINUTE_TIMEFRAMES.keys():
        tf_dir = DATA_DIR / tf
        if tf_dir.exists():
            csv_files = sorted(tf_dir.glob("*.csv"))
            print(f"\n  {tf}/ ({len(csv_files)} 个文件):")
            for csv_file in csv_files:
                size = csv_file.stat().st_size
                print(f"    - {csv_file.name} ({size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
