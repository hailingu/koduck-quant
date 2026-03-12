#!/usr/bin/env python3
"""
Enhanced stock basic information updater.

This script fetches comprehensive stock information from AKShare
and updates the stock_basic table with enhanced dimensions.
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import akshare as ak
import pandas as pd

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db import Database, StockRealtimeDB
from app.services.stock_initializer import classify_stock

import structlog

logger = structlog.get_logger(__name__)


class StockBasicEnhancer:
    """Enhance stock_basic table with comprehensive information."""

    def __init__(self):
        self.batch_size = 100
        self.processed_count = 0
        self.error_count = 0

    async def check_table_structure(self) -> Dict[str, bool]:
        """Check if enhanced columns exist in stock_basic table."""
        columns_to_check = [
            'full_name', 'industry', 'sector', 'province', 'city',
            'total_shares', 'float_shares', 'status'
        ]
        
        results = {}
        for column in columns_to_check:
            try:
                result = await Database.fetchrow(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'stock_basic' AND column_name = $1
                    )
                    """,
                    column
                )
                results[column] = bool(result and result.get('exists', False))
            except Exception as e:
                logger.warning(f"Failed to check column {column}: {e}")
                results[column] = False
        
        return results

    async def fetch_stock_detail_info(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch detailed information for a single stock.
        
        This uses AKShare's stock_individual_info_em to get comprehensive data.
        """
        try:
            # Try to get individual stock info
            df = ak.stock_individual_info_em(symbol=symbol)
            if df is None or df.empty:
                return None
            
            # Convert to dictionary
            info = {}
            for _, row in df.iterrows()
                key = row.get('item', '')
                value = row.get('value', '')
                info[key] = value
            
            return info
        except Exception as e:
            logger.debug(f"Failed to fetch detail info for {symbol}: {e}")
            return None

    async def fetch_all_stocks_detail(self) -> pd.DataFrame:
        """Fetch detailed information for all A-share stocks.
        
        Uses AKShare's stock_zh_a_spot_em which contains comprehensive data.
        """
        try:
            logger.info("Fetching detailed stock information from AKShare...")
            df = ak.stock_zh_a_spot_em()
            
            if df is None or df.empty:
                logger.error("No data returned from AKShare")
                return pd.DataFrame()
            
            logger.info(f"Fetched {len(df)} stocks with detailed info")
            return df
        except Exception as e:
            logger.error(f"Failed to fetch stock details: {e}")
            return pd.DataFrame()

    def _extract_field(self, row: pd.Series, possible_names: List[str], default=None):
        """Extract field from row using multiple possible column names."""
        for name in possible_names:
            if name in row and pd.notna(row[name]):
                return row[name]
        return default

    def _process_stock_detail(self, row: pd.Series) -> Optional[Dict[str, Any]]:
        """Process a single stock's detailed information.
        
        Maps AKShare columns to our database schema.
        """
        try:
            symbol = self._extract_field(row, ['代码', 'symbol', '股票代码'])
            name = self._extract_field(row, ['名称', 'name', '股票名称'])
            
            if not symbol or not name:
                return None
            
            # Clean symbol (remove exchange prefix if present)
            symbol = str(symbol).strip()
            if '.' in symbol:
                symbol = symbol.split('.')[0]
            
            # Classify market and board
            market, board = classify_stock(symbol)
            
            # Extract other fields with multiple possible column names
            full_name = self._extract_field(row, ['公司名称', '全称', 'full_name'])
            industry = self._extract_field(row, ['行业', '所属行业', 'industry'])
            sector = self._extract_field(row, ['板块', '概念', 'sector', '所属概念'])
            province = self._extract_field(row, ['省份', '地区', 'province', '所属地区'])
            city = self._extract_field(row, ['城市', 'city'])
            
            # Share capital (in ten thousands)
            total_shares = self._extract_field(row, ['总股本', '总股本(万股)', 'total_shares'])
            float_shares = self._extract_field(row, ['流通股', '流通股(万股)', 'float_shares'])
            
            # Valuation metrics
            pe_ttm = self._extract_field(row, ['市盈率', '市盈率-动态', 'PE', 'pe_ttm'])
            pb = self._extract_field(row, ['市净率', 'PB', 'pb'])
            ps_ttm = self._extract_field(row, ['市销率', 'PS', 'ps_ttm'])
            
            # Market cap (in )
            market_cap = self._extract_field(row, ['总市值', '总市值(亿元)', 'market_cap'])
            float_market_cap = self._extract_field(row, ['流通市值', '流通市值(亿元)', 'float_market_cap'])
            
            # Calculate float ratio
            float_ratio = None
            if total_shares and float_shares:
                try:
                    float_ratio = float(float_shares) / float(total_shares)
                except (ValueError, TypeError, ZeroDivisionError):
                    pass
            
            # List date
            list_date = self._extract_field(row, ['上市时间', 'list_date'])
            if list_date and isinstance(list_date, str):
                # Try to parse date format
                try:
                    list_date = pd.to_datetime(list_date).date()
                except:
                    list_date = None
            
            # Stock type and status
            stock_type = 'A'  # Default to A-share
            status = 'Active'
            
            # Check for ST/*ST in name
            if '退市' in str(name) or 'Delisted' in str(name):
                status = 'Delisted'
            elif '*ST' in str(name):
                status = '*ST'
            elif 'ST' in str(name):
                status = 'ST'
            
            # Check for Shanghai/Shenzhen Hong Kong Stock Connect
            is_sh = '沪股通' in str(row) or 'Shanghai' in str(row)
            is_sz = '深股通' in str(row) or 'Shenzhen' in str(row)
            
            return {
                'symbol': symbol,
                'name': name,
                'full_name': full_name,
                'short_name': name,  # Use name as short_name
                'market': market,
                'board': board,
                'industry': industry,
                'sector': sector,
                'sub_industry': None,  # Not available in basic API
                'province': province,
                'city': city,
                'total_shares': self._to_int(total_shares),
                'float_shares': self._to_int(float_shares),
                'float_ratio': float_ratio,
                'status': status,
                'is_shanghai_hongkong': is_sh,
                'is_shenzhen_hongkong': is_sz,
                'stock_type': stock_type,
                'list_date': list_date,
                'pe_ttm': self._to_float(pe_ttm),
                'pb': self._to_float(pb),
                'ps_ttm': self._to_float(ps_ttm),
                'market_cap': self._to_float(market_cap),
                'float_market_cap': self._to_float(float_market_cap),
            }
        
        except Exception as e:
            logger.warning(f"Failed to process stock detail: {e}")
            return None

    def _to_int(self, value) -> Optional[int]:
        """Convert value to integer, handling various formats."""
        if value is None or pd.isna(value):
            return None
        try:
            # Handle string with commas
            if isinstance(value, str):
                value = value.replace(',', '').replace('万', '').strip()
            return int(float(value))
        except (ValueError, TypeError):
            return None

    def _to_float(self, value) -> Optional[float]:
        """Convert value to float, handling various formats."""
        if value is None or pd.isna(value):
            return None
        try:
            if isinstance(value, str):
                value = value.replace(',', '').replace('%', '').strip()
            return float(value)
        except (ValueError, TypeError):
            return None

    async def enhance_all_stocks(self) -> Tuple[int, int]:
        """Enhance all stocks in the database with detailed information.
        
        Returns:
            Tuple of (success_count, error_count)
        """
        # Check table structure
        column_status = await self.check_table_structure()
        if not any(column_status.values()):
            logger.error("Enhanced columns not found in stock_basic table. "
                        "Please run database migration first.")
            return 0, 0
        
        logger.info(f"Column status: {column_status}")
        
        # Fetch detailed stock information
        df = await self.fetch_all_stocks_detail()
        if df.empty:
            logger.error("No stock data fetched")
            return 0, 0
        
        success_count = 0
        error_count = 0
        
        logger.info(f"Processing {len(df)} stocks...")
        
        for idx, row in df.iterrows():
            try:
                stock_data = self._process_stock_detail(row)
                if not stock_data:
                    continue
                
                # Insert/update database
                success = await StockRealtimeDB.upsert_stock_basic_full(stock_data)
                
                if success:
                    success_count += 1
                    if success_count % 100 == 0:
                        logger.info(f"Processed {success_count} stocks...")
                else:
                    error_count += 1
                
            except Exception as e:
                logger.warning(f"Failed to process stock at index {idx}: {e}")
                error_count += 1
                continue
        
        logger.info(f"Enhancement completed: {success_count} success, {error_count} errors")
        return success_count, error_count

    async def enhance_single_stock(self, symbol: str) -> bool:
        """Enhance a single stock's information.
        
        Args:
            symbol: Stock symbol to enhance
            
        Returns:
            True if successful
        """
        try:
            # Fetch detail info
            info = await self.fetch_stock_detail_info(symbol)
            if not info:
                logger.warning(f"No detail info found for {symbol}")
                return False
            
            # Build update data
            market, board = classify_stock(symbol)
            
            # Extract valuation metrics
            pe_ttm = info.get('市盈率-动态') or info.get('pe_ttm')
            pb = info.get('市净率') or info.get('pb')
            market_cap = info.get('总市值') or info.get('market_cap')
            
            data = {
                'symbol': symbol,
                'name': info.get('股票简称', info.get('名称', symbol)),
                'full_name': info.get('公司名称'),
                'short_name': info.get('股票简称'),
                'market': market,
                'pe_ttm': self._to_float(pe_ttm),
                'pb': self._to_float(pb),
                'market_cap': self._to_float(market_cap),
                'board': board,
                'total_shares': self._to_int(info.get('总股本')),
                'float_shares': self._to_int(info.get('流通股')),
                'industry': info.get('行业'),
                'sector': info.get('概念'),
                'province': info.get('省份'),
                'city': info.get('城市'),
                'stock_type': 'A',
                'status': 'Active',
            }
            
            success = await StockRealtimeDB.upsert_stock_basic_full(data)
            return success
            
        except Exception as e:
            logger.error(f"Failed to enhance stock {symbol}: {e}")
            return False


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhance stock_basic table with detailed information")
    parser.add_argument("--symbol", type=str, help="Update single stock by symbol")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    
    args = parser.parse_args()
    
    enhancer = StockBasicEnhancer()
    
    # Initialize database connection
    logger.info("Initializing database connection...")
    await Database.get_pool()
    
    try:
        if args.symbol:
            logger.info(f"Enhancing single stock: {args.symbol}")
            success = await enhancer.enhance_single_stock(args.symbol)
            if success:
                logger.info(f"Successfully enhanced {args.symbol}")
            else:
                logger.error(f"Failed to enhance {args.symbol}")
        else:
            logger.info("Enhancing all stocks...")
            success_count, error_count = await enhancer.enhance_all_stocks()
            logger.info(f"Completed: {success_count} success, {error_count} errors")
    
    finally:
        await Database.close()


if __name__ == "__main__":
    asyncio.run(main())
