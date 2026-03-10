"""Fast update stock_basic.csv using batch API."""

import sys
from datetime import datetime, timezone
from pathlib import Path

import akshare as ak
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))


def main():
    csv_path = Path(__file__).parent / "data" / "stock" / "stock_basic.csv"
    
    # Load existing CSV
    df = pd.read_csv(csv_path, encoding='utf-8-sig')
    print(f"Loaded {len(df)} stocks from CSV")
    
    # Convert columns to object type for string storage
    for col in ['industry', 'total_shares', 'float_shares', 'list_date']:
        if col in df.columns:
            df[col] = df[col].astype('object')
    
    # Try to get industry info from spot data which has some industry info
    print("Fetching industry mapping...")
    try:
        # Get spot data which contains some industry info
        spot_df = ak.stock_zh_a_spot_em()
        
        # Check available columns
        print(f"Spot data columns: {[c for c in spot_df.columns if '业' in c or '行业' in c or 'sector' in c.lower()]}")
        
        # Create symbol -> industry mapping if available
        industry_map = {}
        if '所属行业' in spot_df.columns:
            for _, row in spot_df.iterrows():
                code = str(row.get('代码', '')).strip()
                industry = row.get('所属行业', '')
                if code and industry and industry != '-':
                    industry_map[code] = industry
            print(f"Found {len(industry_map)} industry mappings from spot data")
    except Exception as e:
        print(f"Could not get industry from spot data: {e}")
        industry_map = {}
    
    # Process first 10 stocks to test
    print("\nProcessing first 10 stocks as test...")
    for i in range(min(10, len(df))):
        symbol = str(df.at[i, 'symbol']).strip().zfill(6)
        name = df.at[i, 'name']
        
        # Try to get from spot data first
        if symbol in industry_map:
            df.at[i, 'industry'] = industry_map[symbol]
            print(f"  {symbol} {name}: industry={industry_map[symbol]}")
            continue
        
        # Otherwise fetch individual info
        try:
            info = ak.stock_individual_info_em(symbol)
            if info is not None and not info.empty:
                info_dict = {row['item']: row['value'] for _, row in info.iterrows()}
                
                # Industry
                industry = info_dict.get('行业', '')
                if industry and industry != '-':
                    df.at[i, 'industry'] = industry
                
                # Shares
                for key, col in [('总股本', 'total_shares'), ('流通股', 'float_shares')]:
                    value = info_dict.get(key, '')
                    try:
                        if value and str(value).replace('.', '').replace('-', '').isdigit():
                            df.at[i, col] = int(float(str(value).replace(',', '')))
                    except:
                        pass
                
                # List date
                date_str = info_dict.get('上市时间', '')
                if date_str and len(str(date_str)) == 8:
                    df.at[i, 'list_date'] = f"{str(date_str)[:4]}-{str(date_str)[4:6]}-{str(date_str)[6:8]}"
                
                print(f"  {symbol} {name}: industry={industry}")
        except Exception as e:
            print(f"  {symbol} {name}: Error - {e}")
    
    # Show summary for test
    print("\nTest results (first 10):")
    print(df[['symbol', 'name', 'industry', 'total_shares', 'list_date']].head(10).to_string(index=False))
    
    print("\nNow processing all stocks... (this will take ~5-10 minutes)")
    
    # Process all stocks
    updated = 0
    for i in range(len(df)):
        symbol = str(df.at[i, 'symbol']).strip().zfill(6)
        
        # Skip if already has industry from spot data
        if symbol in industry_map and pd.isna(df.at[i, 'industry']):
            df.at[i, 'industry'] = industry_map[symbol]
            updated += 1
            continue
        
        # Skip if already has data
        if not pd.isna(df.at[i, 'industry']) and not pd.isna(df.at[i, 'total_shares']):
            continue
        
        try:
            info = ak.stock_individual_info_em(symbol)
            if info is not None and not info.empty:
                info_dict = {row['item']: row['value'] for _, row in info.iterrows()}
                
                # Industry
                if pd.isna(df.at[i, 'industry']):
                    industry = info_dict.get('行业', '')
                    if industry and industry != '-':
                        df.at[i, 'industry'] = industry
                        updated += 1
                
                # Shares
                for key, col in [('总股本', 'total_shares'), ('流通股', 'float_shares')]:
                    if pd.isna(df.at[i, col]):
                        value = info_dict.get(key, '')
                        try:
                            if value and str(value).replace('.', '').replace('-', '').isdigit():
                                df.at[i, col] = int(float(str(value).replace(',', '')))
                        except:
                            pass
                
                # List date
                if pd.isna(df.at[i, 'list_date']):
                    date_str = info_dict.get('上市时间', '')
                    if date_str and len(str(date_str)) == 8:
                        df.at[i, 'list_date'] = f"{str(date_str)[:4]}-{str(date_str)[4:6]}-{str(date_str)[6:8]}"
                
                # Calculate float_ratio
                if pd.notna(df.at[i, 'total_shares']) and pd.notna(df.at[i, 'float_shares']):
                    try:
                        df.at[i, 'float_ratio'] = float(df.at[i, 'float_shares']) / float(df.at[i, 'total_shares'])
                    except:
                        pass
        except:
            pass
        
        # Progress every 100 stocks
        if (i + 1) % 100 == 0:
            print(f"  Processed {i+1}/{len(df)} stocks, updated {updated}...")
    
    # Update timestamp
    df['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Save
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"\nSaved to {csv_path}")
    
    # Summary
    print("\nFinal statistics:")
    for col in ['industry', 'total_shares', 'float_shares', 'list_date']:
        non_null = df[col].notna().sum()
        print(f"  {col}: {non_null}/{len(df)} ({non_null/len(df)*100:.1f}%)")


if __name__ == "__main__":
    print("=" * 60)
    print("Stock Basic CSV Updater (Fast)")
    print("=" * 60)
    main()
