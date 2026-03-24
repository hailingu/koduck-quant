"""Stock basic data manager with CSV caching.

This module manages stock basic information with local CSV caching,
similar to how kline data is managed.
"""

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import akshare as ak
import pandas as pd
import structlog

from app.db import Database, StockRealtimeDB
from app.services.stock_initializer import classify_stock

logger = structlog.get_logger(__name__)

# Data directory for stock basic
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "stock"
CSV_FILE = DATA_DIR / "stock_basic.csv"


class StockBasicManager:
    """Manage stock basic data with CSV caching."""

    def __init__(self):
        self.data_dir = DATA_DIR
        self.csv_file = CSV_FILE
        self._schema_ensured = False
        self._ensure_directory()

    def _ensure_directory(self):
        """Ensure data directory exists."""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    async def _ensure_stock_basic_full_schema(self) -> bool:
        """Ensure stock_basic has all columns/indexes needed by full upsert.

        This is an idempotent self-healing step for environments where Flyway
        is not enabled. It keeps data-service startup resilient after a fresh
        database rebuild (e.g. make dev-rebuild-clean).
        """
        ddl_statements = [
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS board VARCHAR(20)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS industry VARCHAR(100)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sector VARCHAR(100)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sub_industry VARCHAR(100)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS province VARCHAR(50)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS city VARCHAR(50)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS total_shares BIGINT",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_shares BIGINT",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_ratio DECIMAL(5, 4)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active'",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shanghai_hongkong BOOLEAN DEFAULT FALSE",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shenzhen_hongkong BOOLEAN DEFAULT FALSE",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS stock_type VARCHAR(20) DEFAULT 'A'",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pe_ttm DECIMAL(12, 4)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pb DECIMAL(12, 4)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS ps_ttm DECIMAL(12, 4)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS market_cap DECIMAL(18, 2)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_market_cap DECIMAL(18, 2)",
            "ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS turnover_rate DECIMAL(10, 4)",
            "CREATE INDEX IF NOT EXISTS idx_stock_basic_board ON stock_basic(board)",
            "CREATE INDEX IF NOT EXISTS idx_stock_basic_market_board ON stock_basic(market, board)",
            "CREATE INDEX IF NOT EXISTS idx_stock_basic_industry ON stock_basic(industry)",
            "CREATE INDEX IF NOT EXISTS idx_stock_basic_sector ON stock_basic(sector)",
        ]

        try:
            for ddl in ddl_statements:
                await Database.execute(ddl)
            logger.info("Ensured stock_basic enhanced schema for data-service full upsert")
            return True
        except Exception as e:
            logger.error(f"Failed to ensure stock_basic enhanced schema: {e}")
            return False

    async def _ensure_schema_once(self) -> bool:
        """Ensure schema only once per process lifecycle."""
        if self._schema_ensured:
            return True

        schema_ok = await self._ensure_stock_basic_full_schema()
        if schema_ok:
            self._schema_ensured = True
        return schema_ok

    def _extract_field(self, row: pd.Series, possible_names: list[str], default=None):
        """Extract field from row using multiple possible column names."""
        for name in possible_names:
            if name in row and pd.notna(row[name]):
                return row[name]
        return default

    def _to_int(self, value) -> Optional[int]:
        """Convert value to integer, handling various formats."""
        if value is None or pd.isna(value):
            return None
        try:
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

    def _process_stock_row(self, row: pd.Series) -> Optional[dict]:
        """Process a single stock row from AKShare data."""
        try:
            symbol = self._extract_field(row, ['代码', 'symbol', '股票代码'])
            name = self._extract_field(row, ['名称', 'name', '股票名称'])

            if not symbol or not name:
                return None

            # Clean symbol
            symbol = str(symbol).strip()
            if '.' in symbol:
                symbol = symbol.split('.')[0]

            # Classify market and board
            market, board = classify_stock(symbol)

            # Extract fields
            industry = self._extract_field(row, ['行业', '所属行业', 'industry'])
            sector = self._extract_field(row, ['板块', '概念', 'sector', '所属概念'])
            province = self._extract_field(row, ['省份', '地区', 'province', '所属地区'])
            city = self._extract_field(row, ['城市', 'city'])

            # Share capital
            total_shares = self._extract_field(row, ['总股本', '总股本(万股)', 'total_shares'])
            float_shares = self._extract_field(row, ['流通股', '流通股(万股)', 'float_shares'])

            # Calculate float ratio
            float_ratio = None
            if total_shares and float_shares:
                try:
                    float_ratio = float(float_shares) / float(total_shares)
                except (ValueError, TypeError, ZeroDivisionError):
                    pass

            # Valuation metrics
            pe_ttm = self._extract_field(row, ['市盈率', '市盈率-动态', 'PE', 'pe_ttm', '动态市盈率'])
            pb = self._extract_field(row, ['市净率', 'PB', 'pb'])
            ps_ttm = self._extract_field(row, ['市销率', 'PS', 'ps_ttm'])

            # Market cap (in )
            market_cap = self._extract_field(row, ['总市值', '总市值(亿元)', 'market_cap'])
            float_market_cap = self._extract_field(row, ['流通市值', '流通市值(亿元)', 'float_market_cap'])

            # List date
            list_date = self._extract_field(row, ['上市时间', 'list_date'])
            if list_date and isinstance(list_date, str):
                try:
                    list_date = pd.to_datetime(list_date).strftime('%Y-%m-%d')
                except:
                    list_date = None

            # Determine status from name
            status = 'Active'
            if '退市' in str(name) or 'Delisted' in str(name):
                status = 'Delisted'
            elif '*ST' in str(name):
                status = '*ST'
            elif 'ST' in str(name):
                status = 'ST'

            # Check for Hong Kong Stock Connect
            is_sh = '沪股通' in str(row) or any('沪股通' in str(v) for v in row.values if pd.notna(v))
            is_sz = '深股通' in str(row) or any('深股通' in str(v) for v in row.values if pd.notna(v))

            return {
                'symbol': symbol,
                'name': name,
                'market': market,
                'board': board,
                'industry': industry,
                'sector': sector,
                'sub_industry': None,
                'province': province,
                'city': city,
                'total_shares': self._to_int(total_shares),
                'float_shares': self._to_int(float_shares),
                'float_ratio': float_ratio,
                'status': status,
                'is_shanghai_hongkong': is_sh,
                'is_shenzhen_hongkong': is_sz,
                'stock_type': 'A',
                'list_date': list_date,
                'pe_ttm': self._to_float(pe_ttm),
                'pb': self._to_float(pb),
                'ps_ttm': self._to_float(ps_ttm),
                'market_cap': self._to_float(market_cap),
                'float_market_cap': self._to_float(float_market_cap),
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.warning(f"Failed to process stock row: {e}")
            return None

    async def fetch_from_api(self) -> pd.DataFrame:
        """Fetch stock basic data from AKShare API."""
        try:
            logger.info("Fetching stock basic data from AKShare...")
            df = ak.stock_zh_a_spot_em()

            if df is None or df.empty:
                logger.error("No data returned from AKShare")
                return pd.DataFrame()

            logger.info(f"Fetched {len(df)} stocks from API")
            return df

        except Exception as e:
            logger.error(f"Failed to fetch from API: {e}")
            return pd.DataFrame()

    async def save_to_csv(self, df: pd.DataFrame) -> bool:
        """Save stock data to CSV file."""
        try:
            if df.empty:
                logger.warning("No data to save")
                return False

            # Process all rows
            records = []
            for _, row in df.iterrows():
                record = self._process_stock_row(row)
                if record:
                    records.append(record)

            if not records:
                logger.warning("No valid records to save")
                return False

            # Convert to DataFrame and save
            save_df = pd.DataFrame(records)
            save_df.to_csv(self.csv_file, index=False, encoding='utf-8-sig')

            logger.info(f"Saved {len(records)} stocks to {self.csv_file}")
            return True

        except Exception as e:
            logger.error(f"Failed to save to CSV: {e}")
            return False

    def load_from_csv(self) -> pd.DataFrame:
        """Load stock data from CSV file."""
        try:
            if not self.csv_file.exists():
                logger.warning(f"CSV file not found: {self.csv_file}")
                return pd.DataFrame()

            df = pd.read_csv(self.csv_file, encoding='utf-8-sig')

            # Check if data is stale (older than 7 days)
            if 'updated_at' in df.columns and not df.empty:
                try:
                    last_update = pd.to_datetime(df['updated_at'].iloc[0])
                    days_old = (datetime.now(timezone.utc) - last_update).days
                    if days_old > 7:
                        logger.warning(f"CSV data is {days_old} days old, consider refreshing")
                except:
                    pass

            logger.info(f"Loaded {len(df)} stocks from {self.csv_file}")
            return df

        except Exception as e:
            logger.error(f"Failed to load from CSV: {e}")
            return pd.DataFrame()

    async def import_to_database(self, df: pd.DataFrame) -> tuple[int, int]:
        """Import stock data from DataFrame to database."""
        if df.empty:
            logger.warning("No data to import")
            return 0, 0

        schema_ok = await self._ensure_schema_once()
        if not schema_ok:
            logger.warning("stock_basic schema not fully ensured before import")

        success_count = 0
        error_count = 0

        for _, row in df.iterrows():
            try:
                # Convert row to dict
                data = row.to_dict()

                # Handle NaN values and ensure symbol is string
                for key, value in data.items():
                    if pd.isna(value):
                        data[key] = None
                    elif key == 'symbol':
                        # Ensure symbol is always a string
                        data[key] = str(value)
                    elif key == 'list_date' and value:
                        # Ensure list_date is a date object
                        if isinstance(value, str):
                            try:
                                from datetime import datetime
                                data[key] = datetime.strptime(value, '%Y-%m-%d').date()
                            except:
                                data[key] = None

                success = await StockRealtimeDB.upsert_stock_basic_full(data)

                if success:
                    success_count += 1
                    if success_count % 100 == 0:
                        logger.info(f"Imported {success_count} stocks...")
                else:
                    error_count += 1

            except Exception as e:
                logger.warning(f"Failed to import stock {row.get('symbol')}: {e}")
                error_count += 1

        logger.info(f"Import completed: {success_count} success, {error_count} errors")
        return success_count, error_count

    async def initialize(self, force_refresh: bool = False) -> bool:
        """Initialize stock basic data.

        Args:
            force_refresh: If True, fetch from API even if CSV exists

        Returns:
            True if successful
        """
        schema_ok = await self._ensure_schema_once()
        if not schema_ok:
            logger.warning("stock_basic schema self-healing failed; import may be partially unavailable")

        # Try to load from CSV first
        if not force_refresh and self.csv_file.exists():
            logger.info("Loading stock basic data from CSV...")
            df = self.load_from_csv()
            if not df.empty:
                success_count, error_count = await self.import_to_database(df)
                return success_count > 0

        # Fetch from API
        logger.info("Fetching stock basic data from API...")
        df = await self.fetch_from_api()
        if df.empty:
            logger.error("Failed to fetch data from API")
            return False

        # Save to CSV
        if await self.save_to_csv(df):
            # Load from CSV (to ensure consistent format)
            df = self.load_from_csv()

        # Import to database
        if not df.empty:
            success_count, error_count = await self.import_to_database(df)
            return success_count > 0

        return False

    async def refresh(self) -> bool:
        """Force refresh stock basic data from API."""
        logger.info("Refreshing stock basic data...")
        return await self.initialize(force_refresh=True)


# Global instance
stock_basic_manager = StockBasicManager()
