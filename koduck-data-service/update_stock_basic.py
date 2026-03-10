#!/usr/bin/env python3
"""Update stock_basic.csv with detailed info from AKShare.
Estimated time: ~5 minutes for 5815 stocks."""

import sys
from datetime import datetime, timezone
from pathlib import Path

import akshare as ak
import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))


def fetch_stock_detail(symbol: str) -> dict:
    """Fetch stock detail info from AKShare."""
    try:
        symbol = str(symbol).strip().zfill(6)
        info = ak.stock_individual_info_em(symbol)
        if info is None or info.empty:
            return {}
        return {row['item']: row['value'] for _, row in info.iterrows()}
    except Exception:
        return {}


def main():
    csv_path = Path(__file__).parent / "data" / "stock" / "stock_basic.csv"
    
    # Load CSV
    df = pd.read_csv(csv_path, encoding='utf-8-sig')
    print(f"Loaded {len(df)} stocks from CSV")
    
    # Ensure columns are object type
    for col in ['industry', 'total_shares', 'float_shares', 'list_date', 'float_ratio']:
        if col in df.columns:
            df[col] = df[col].astype('object')
    
    # Process all stocks
    updated_industry = 0
    updated_shares = 0
    updated_list_date = 0
    
    print("Fetching details for all stocks (this will take ~5 minutes)...")
    for i in tqdm(range(len(df)), desc="Processing"):
        symbol = str(df.at[i, 'symbol']).strip()
        
        # Skip if already has all data
        has_industry = pd.notna(df.at[i, 'industry'])
        has_shares = pd.notna(df.at[i, 'total_shares'])
        has_list_date = pd.notna(df.at[i, 'list_date'])
        
        if has_industry and has_shares and has_list_date:
            continue
        
        info = fetch_stock_detail(symbol)
        if not info:
            continue
        
        # Industry
        if not has_industry:
            industry = info.get('行业', '')
            if industry and industry != '-' and str(industry).strip():
                df.at[i, 'industry'] = str(industry).strip()
                updated_industry += 1
        
        # Total shares
        if not has_shares:
            try:
                value = info.get('总股本', '')
                if value and str(value).replace('.', '').replace('-', '').isdigit():
                    df.at[i, 'total_shares'] = int(float(str(value).replace(',', '')))
                    updated_shares += 1
            except:
                pass
        
        # Float shares
        if pd.isna(df.at[i, 'float_shares']):
            try:
                value = info.get('流通股', '')
                if value and str(value).replace('.', '').replace('-', '').isdigit():
                    df.at[i, 'float_shares'] = int(float(str(value).replace(',', '')))
            except:
                pass
        
        # List date
        if not has_list_date:
            date_str = info.get('上市时间', '')
            if date_str and len(str(date_str)) == 8:
                df.at[i, 'list_date'] = f"{str(date_str)[:4]}-{str(date_str)[4:6]}-{str(date_str)[6:8]}"
                updated_list_date += 1
        
        # Calculate float_ratio
        if pd.notna(df.at[i, 'total_shares']) and pd.notna(df.at[i, 'float_shares']):
            try:
                total = float(df.at[i, 'total_shares'])
                float_val = float(df.at[i, 'float_shares'])
                if total > 0:
                    df.at[i, 'float_ratio'] = round(float_val / total, 4)
            except:
                pass
    
    # Update timestamp
    df['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Save
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"\n✅ Saved to {csv_path}")
    
    # Summary
    print("\nUpdate summary:")
    print(f"  Industry: {updated_industry} updated")
    print(f"  Shares: {updated_shares} updated")
    print(f"  List date: {updated_list_date} updated")
    
    print("\nFinal statistics:")
    for col in ['industry', 'total_shares', 'float_shares', 'list_date', 'float_ratio']:
        non_null = df[col].notna().sum()
        print(f"  {col}: {non_null}/{len(df)} ({non_null/len(df)*100:.1f}%)")
    
    # Show sample
    print("\nSample data:")
    sample = df[['symbol', 'name', 'industry', 'total_shares', 'list_date']].dropna().head(5)
    print(sample.to_string(index=False))


if __name__ == "__main__":
    print("=" * 60)
    print("Stock Basic CSV Updater")
    print("=" * 60)
    main()
