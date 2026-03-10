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

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.akshare_client import akshare_client

# 数据目录
DATA_DIR = project_root / "data" / "kline"
DAILY_DIR = DATA_DIR / "1D"
WEEKLY_DIR = DATA_DIR / "1W"


def get_all_daily_symbols():
    """获取所有有日线数据的股票代码"""
    if not DAILY_DIR.exists():
        print(f"日线数据目录不存在: {DAILY_DIR}")
        return []
    
    symbols = []
    for csv_file in DAILY_DIR.glob("*.csv"):
        symbol = csv_file.stem  # 去掉 .csv 后缀
        symbols.append(symbol)
    
    return sorted(symbols)


def save_to_csv(klines: list[dict], symbol: str, timeframe: str = "1W"):
    """将K线数据保存到CSV文件"""
    import pandas as pd
    
    if not klines:
        return 0
    
    # 构建目录
    save_dir = DATA_DIR / timeframe
    save_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = save_dir / f"{symbol}.csv"
    
    # 转换为DataFrame
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
    
    # 保存到CSV
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    
    return len(df)


async def fetch_weekly_for_symbol(symbol: str, limit: int = 500):
    """获取单只股票的周线数据"""
    try:
        # 使用方法2: AKShare客户端获取周线数据
        klines = await asyncio.to_thread(
            akshare_client.get_kline_data,
            symbol=symbol,
            period="weekly",  # 周线
            limit=limit
        )
        
        if not klines:
            return None, 0
        
        # 保存到CSV
        count = save_to_csv(klines, symbol, "1W")
        
        return klines, count
        
    except Exception as e:
        print(f"  获取 {symbol} 周线数据失败: {e}")
        return None, 0


async def main():
    """主函数"""
    print("=" * 60)
    print("使用方法2 (AKShare客户端) 获取周线数据")
    print("=" * 60)
    
    # 获取所有日线股票列表
    symbols = get_all_daily_symbols()
    print(f"\n发现 {len(symbols)} 只日线数据股票: {symbols}")
    
    # 创建周线目录
    WEEKLY_DIR.mkdir(parents=True, exist_ok=True)
    print(f"周线数据保存目录: {WEEKLY_DIR}")
    
    # 统计
    success_count = 0
    fail_count = 0
    total_records = 0
    
    print("\n" + "-" * 60)
    print("开始获取周线数据...")
    print("-" * 60)
    
    for i, symbol in enumerate(symbols, 1):
        print(f"\n[{i}/{len(symbols)}] 正在获取 {symbol} 的周线数据...")
        
        klines, count = await fetch_weekly_for_symbol(symbol)
        
        if klines:
            success_count += 1
            total_records += count
            
            # 显示数据范围
            first_date = datetime.fromtimestamp(klines[0]["timestamp"]).strftime("%Y-%m-%d")
            last_date = datetime.fromtimestamp(klines[-1]["timestamp"]).strftime("%Y-%m-%d")
            
            print(f"  ✓ 成功获取 {count} 条周线数据")
            print(f"    数据范围: {first_date} ~ {last_date}")
            print(f"    最新收盘: {klines[-1]['close']}")
        else:
            fail_count += 1
            print(f"  ✗ 获取失败或暂无数据")
        
        # 添加小延迟避免请求过快
        await asyncio.sleep(0.5)
    
    # 汇总
    print("\n" + "=" * 60)
    print("获取完成!")
    print(f"  成功: {success_count} 只股票")
    print(f"  失败: {fail_count} 只股票")
    print(f"  总记录数: {total_records} 条周线数据")
    print(f"  保存位置: {WEEKLY_DIR}")
    print("=" * 60)
    
    # 列出保存的文件
    print("\n已保存的周线数据文件:")
    for csv_file in sorted(WEEKLY_DIR.glob("*.csv")):
        size = csv_file.stat().st_size
        print(f"  - {csv_file.name} ({size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
