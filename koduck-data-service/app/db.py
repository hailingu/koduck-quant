"""Database connection and operations for PostgreSQL."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

import asyncpg
from app.config import settings

logger = logging.getLogger(__name__)

# Database configuration - read from settings
DB_HOST = settings.POSTGRES_HOST
DB_PORT = settings.POSTGRES_PORT
DB_NAME = settings.POSTGRES_DB
DB_USER = settings.POSTGRES_USER
DB_PASSWORD = settings.POSTGRES_PASSWORD

logger.info(f"Database config: host={DB_HOST}, port={DB_PORT}, db={DB_NAME}, user={DB_USER}")

# SQL queries
INSERT_STOCK_REALTIME = """
INSERT INTO stock_realtime (
    symbol, name, price, open_price, high, low, prev_close,
    volume, amount, change_amount, change_percent,
    bid_price, bid_volume, ask_price, ask_volume, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    open_price = EXCLUDED.open_price,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    prev_close = EXCLUDED.prev_close,
    volume = EXCLUDED.volume,
    amount = EXCLUDED.amount,
    change_amount = EXCLUDED.change_amount,
    change_percent = EXCLUDED.change_percent,
    bid_price = EXCLUDED.bid_price,
    bid_volume = EXCLUDED.bid_volume,
    ask_price = EXCLUDED.ask_price,
    ask_volume = EXCLUDED.ask_volume,
    updated_at = NOW()
"""

# Basic stock info insert (for realtime updates)
INSERT_STOCK_BASIC = """
INSERT INTO stock_basic (symbol, name, market, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW()
"""

# Full stock info insert (for initialization with enhanced fields)
INSERT_STOCK_BASIC_FULL = """
INSERT INTO stock_basic (
    symbol, name, market, board, 
    industry, sector, sub_industry, province, city,
    total_shares, float_shares, float_ratio, status,
    is_shanghai_hongkong, is_shenzhen_hongkong, stock_type,
    list_date, pe_ttm, pb, ps_ttm, market_cap, float_market_cap,
    updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    market = EXCLUDED.market,
    board = EXCLUDED.board,
    industry = EXCLUDED.industry,
    sector = EXCLUDED.sector,
    sub_industry = EXCLUDED.sub_industry,
    province = EXCLUDED.province,
    city = EXCLUDED.city,
    total_shares = EXCLUDED.total_shares,
    float_shares = EXCLUDED.float_shares,
    float_ratio = EXCLUDED.float_ratio,
    status = EXCLUDED.status,
    is_shanghai_hongkong = EXCLUDED.is_shanghai_hongkong,
    is_shenzhen_hongkong = EXCLUDED.is_shenzhen_hongkong,
    stock_type = EXCLUDED.stock_type,
    list_date = EXCLUDED.list_date,
    pe_ttm = EXCLUDED.pe_ttm,
    pb = EXCLUDED.pb,
    ps_ttm = EXCLUDED.ps_ttm,
    market_cap = EXCLUDED.market_cap,
    float_market_cap = EXCLUDED.float_market_cap,
    updated_at = NOW()
"""

SELECT_STOCK_REALTIME = """
SELECT symbol, name, price, open_price, high, low, prev_close,
       volume, amount, change_amount, change_percent,
       bid_price, bid_volume, ask_price, ask_volume, updated_at
FROM stock_realtime WHERE symbol = $1
"""

# Stock basic query for valuation metrics
SELECT_STOCK_BASIC_VALUATION = """
SELECT symbol, name, pe_ttm, pb, ps_ttm, market_cap, float_market_cap, 
       total_shares, float_shares, float_ratio, turnover_rate
FROM stock_basic WHERE symbol = $1
"""

# Tick History SQL queries
INSERT_TICK_HISTORY = """
INSERT INTO stock_tick_history (
    symbol, tick_time, price, open_price, high, low, prev_close,
    volume, amount, change_amount, change_percent,
    bid_price, bid_volume, ask_price, ask_volume, raw_data
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
"""

INSERT_TICK_HISTORY_BATCH = """
INSERT INTO stock_tick_history (
    symbol, tick_time, price, open_price, high, low, prev_close,
    volume, amount, change_amount, change_percent,
    bid_price, bid_volume, ask_price, ask_volume, raw_data
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
"""

SELECT_TICK_HISTORY = """
SELECT id, symbol, tick_time, price, open_price, high, low, prev_close,
       volume, amount, change_amount, change_percent,
       bid_price, bid_volume, ask_price, ask_volume, raw_data, created_at
FROM stock_tick_history 
WHERE symbol = $1 AND tick_time BETWEEN $2 AND $3
ORDER BY tick_time ASC
LIMIT $4 OFFSET $5
"""

SELECT_TICK_HISTORY_COUNT = """
SELECT COUNT(*) as total
FROM stock_tick_history 
WHERE symbol = $1 AND tick_time BETWEEN $2 AND $3
"""

SELECT_TICK_HISTORY_LATEST = """
SELECT id, symbol, tick_time, price, open_price, high, low, prev_close,
       volume, amount, change_amount, change_percent,
       bid_price, bid_volume, ask_price, ask_volume, raw_data, created_at
FROM stock_tick_history 
WHERE symbol = $1
ORDER BY tick_time DESC
LIMIT $2
"""

DELETE_OLD_TICK_HISTORY = """
DELETE FROM stock_tick_history 
WHERE tick_time < $1
"""


class Database:
    """PostgreSQL database connection pool."""
    
    _pool: Optional[asyncpg.Pool] = None
    
    @classmethod
    async def get_pool(cls) -> asyncpg.Pool:
        """Get or create connection pool."""
        if cls._pool is None:
            cls._pool = await asyncpg.create_pool(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                min_size=5,
                max_size=20,
            )
            logger.info("Database connection pool created")
        return cls._pool
    
    @classmethod
    async def close(cls):
        """Close connection pool."""
        if cls._pool:
            await cls._pool.close()
            cls._pool = None
            logger.info("Database connection pool closed")
    
    @classmethod
    async def execute(cls, query: str, *args):
        """Execute a query."""
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)
    
    @classmethod
    async def fetchrow(cls, query: str, *args):
        """Fetch a single row."""
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *args)
    
    @classmethod
    async def fetch(cls, query: str, *args):
        """Fetch multiple rows."""
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)


class StockRealtimeDB:
    """Stock realtime data database operations."""
    
    @staticmethod
    async def upsert_stock(data: Dict):
        """Insert or update stock realtime data."""
        try:
            await Database.execute(
                INSERT_STOCK_REALTIME,
                data['symbol'],
                data.get('name', ''),
                data.get('price'),
                data.get('open'),
                data.get('high'),
                data.get('low'),
                data.get('prev_close'),
                data.get('volume'),
                data.get('amount'),
                data.get('change'),
                data.get('change_percent'),
                data.get('bid_price'),
                data.get('bid_volume'),
                data.get('ask_price'),
                data.get('ask_volume'),
            )
            logger.debug(f"Upserted stock realtime data: {data['symbol']}")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert stock {data.get('symbol')}: {e}")
            return False
    
    @staticmethod
    async def upsert_stock_basic(symbol: str, name: str, market: str = "AShare"):
        """Insert or update stock basic info."""
        try:
            await Database.execute(INSERT_STOCK_BASIC, symbol, name, market)
            logger.debug(f"Upserted stock basic: {symbol}")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert stock basic {symbol}: {e}")
            return False
    
    @staticmethod
    async def upsert_stock_basic_full(data: Dict) -> bool:
        """Insert or update stock basic info with full details.
        
        Args:
            data: Dictionary containing all stock basic fields
            
        Returns:
            True if successful, False otherwise
        """
        try:
            await Database.execute(
                INSERT_STOCK_BASIC_FULL,
                data.get('symbol'),
                data.get('name'),
                data.get('market'),
                data.get('board'),
                data.get('industry'),
                data.get('sector'),
                data.get('sub_industry'),
                data.get('province'),
                data.get('city'),
                data.get('total_shares'),
                data.get('float_shares'),
                data.get('float_ratio'),
                data.get('status', 'Active'),
                data.get('is_shanghai_hongkong', False),
                data.get('is_shenzhen_hongkong', False),
                data.get('stock_type', 'A'),
                data.get('list_date'),
                data.get('pe_ttm'),
                data.get('pb'),
                data.get('ps_ttm'),
                data.get('market_cap'),
                data.get('float_market_cap'),
            )
            logger.debug(f"Upserted full stock basic: {data.get('symbol')}")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert full stock basic {data.get('symbol')}: {e}")
            return False
    
    @staticmethod
    async def get_stock(symbol: str) -> Optional[Dict]:
        """Get stock realtime data by symbol."""
        try:
            row = await Database.fetchrow(SELECT_STOCK_REALTIME, symbol)
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Failed to get stock {symbol}: {e}")
            return None
    
    @staticmethod
    async def get_stock_valuation(symbol: str) -> Optional[Dict]:
        """Get stock valuation metrics (PE, PB, market cap, etc.) from stock_basic table."""
        try:
            row = await Database.fetchrow(SELECT_STOCK_BASIC_VALUATION, symbol)
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Failed to get stock valuation for {symbol}: {e}")
            return None


@dataclass
class TickHistoryRecord:
    """Tick history record data class."""
    symbol: str
    tick_time: datetime
    price: float
    open_price: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    prev_close: Optional[float] = None
    volume: Optional[int] = None
    amount: Optional[float] = None
    change_amount: Optional[float] = None
    change_percent: Optional[float] = None
    bid_price: Optional[float] = None
    bid_volume: Optional[int] = None
    ask_price: Optional[float] = None
    ask_volume: Optional[int] = None
    raw_data: Optional[Dict] = None


class TickHistoryDB:
    """Stock tick history data database operations."""
    
    @staticmethod
    async def insert_tick(record: TickHistoryRecord) -> bool:
        """Insert a single tick history record.
        
        Args:
            record: TickHistoryRecord object containing tick data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import json
            raw_data_json = json.dumps(record.raw_data) if record.raw_data else None
            
            await Database.execute(
                INSERT_TICK_HISTORY,
                record.symbol,
                record.tick_time,
                record.price,
                record.open_price,
                record.high,
                record.low,
                record.prev_close,
                record.volume,
                record.amount,
                record.change_amount,
                record.change_percent,
                record.bid_price,
                record.bid_volume,
                record.ask_price,
                record.ask_volume,
                raw_data_json,
            )
            logger.debug(f"Inserted tick history: {record.symbol} @ {record.tick_time}")
            return True
        except Exception as e:
            logger.error(f"Failed to insert tick history {record.symbol}: {e}")
            return False
    
    @staticmethod
    async def insert_tick_from_dict(data: Dict, tick_time: Optional[datetime] = None) -> bool:
        """Insert a tick history record from a dictionary.
        
        Args:
            data: Dictionary containing stock data (same format as stock_realtime)
            tick_time: Optional tick timestamp (defaults to now)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import json
            
            if tick_time is None:
                tick_time = datetime.now()
            
            # Store raw data as JSONB
            raw_data = dict(data) if data else None
            raw_data_json = json.dumps(raw_data) if raw_data else None
            
            await Database.execute(
                INSERT_TICK_HISTORY,
                data.get('symbol'),
                tick_time,
                data.get('price'),
                data.get('open'),
                data.get('high'),
                data.get('low'),
                data.get('prev_close'),
                data.get('volume'),
                data.get('amount'),
                data.get('change'),
                data.get('change_percent'),
                data.get('bid_price'),
                data.get('bid_volume'),
                data.get('ask_price'),
                data.get('ask_volume'),
                raw_data_json,
            )
            logger.debug(f"Inserted tick history: {data.get('symbol')} @ {tick_time}")
            return True
        except Exception as e:
            logger.error(f"Failed to insert tick history from dict: {e}")
            return False
    
    @staticmethod
    async def insert_ticks_batch(records: List[TickHistoryRecord]) -> Tuple[int, int]:
        """Insert multiple tick history records in batch.
        
        Args:
            records: List of TickHistoryRecord objects
            
        Returns:
            Tuple of (success_count, fail_count)
        """
        if not records:
            return 0, 0
        
        success_count = 0
        fail_count = 0
        
        try:
            import json
            pool = await Database.get_pool()
            
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for record in records:
                        try:
                            raw_data_json = json.dumps(record.raw_data) if record.raw_data else None
                            await conn.execute(
                                INSERT_TICK_HISTORY_BATCH,
                                record.symbol,
                                record.tick_time,
                                record.price,
                                record.open_price,
                                record.high,
                                record.low,
                                record.prev_close,
                                record.volume,
                                record.amount,
                                record.change_amount,
                                record.change_percent,
                                record.bid_price,
                                record.bid_volume,
                                record.ask_price,
                                record.ask_volume,
                                raw_data_json,
                            )
                            success_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to insert tick in batch: {e}")
                            fail_count += 1
            
            logger.info(f"Batch insert: {success_count} succeeded, {fail_count} failed")
            return success_count, fail_count
        except Exception as e:
            logger.error(f"Batch insert failed: {e}")
            return 0, len(records)
    
    @staticmethod
    async def get_ticks_by_time_range(
        symbol: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 1000,
        offset: int = 0
    ) -> List[Dict]:
        """Get tick history for a symbol within a time range.
        
        Args:
            symbol: Stock symbol
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum number of records to return
            offset: Offset for pagination
            
        Returns:
            List of tick history records as dictionaries
        """
        try:
            rows = await Database.fetch(
                SELECT_TICK_HISTORY,
                symbol,
                start_time,
                end_time,
                limit,
                offset
            )
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get tick history for {symbol}: {e}")
            return []
    
    @staticmethod
    async def get_ticks_count(symbol: str, start_time: datetime, end_time: datetime) -> int:
        """Get count of tick history records for a symbol within a time range.
        
        Args:
            symbol: Stock symbol
            start_time: Start of time range
            end_time: End of time range
            
        Returns:
            Count of matching records
        """
        try:
            row = await Database.fetchrow(
                SELECT_TICK_HISTORY_COUNT,
                symbol,
                start_time,
                end_time
            )
            return row['total'] if row else 0
        except Exception as e:
            logger.error(f"Failed to get tick count for {symbol}: {e}")
            return 0
    
    @staticmethod
    async def get_latest_ticks(symbol: str, limit: int = 100) -> List[Dict]:
        """Get the most recent tick history records for a symbol.
        
        Args:
            symbol: Stock symbol
            limit: Maximum number of records to return
            
        Returns:
            List of tick history records as dictionaries
        """
        try:
            rows = await Database.fetch(SELECT_TICK_HISTORY_LATEST, symbol, limit)
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get latest ticks for {symbol}: {e}")
            return []
    
    @staticmethod
    async def delete_old_ticks(cutoff_time: datetime) -> int:
        """Delete tick history records older than the cutoff time.
        
        Args:
            cutoff_time: Delete records before this time
            
        Returns:
            Number of records deleted
        """
        try:
            result = await Database.execute(DELETE_OLD_TICK_HISTORY, cutoff_time)
            # Parse result like "DELETE 1000"
            parts = result.split()
            deleted_count = int(parts[1]) if len(parts) > 1 else 0
            logger.info(f"Deleted {deleted_count} old tick records")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete old ticks: {e}")
            return 0
    
    @staticmethod
    async def cleanup_expired_data(retention_days: int = None) -> int:
        """Clean up expired tick history data based on retention policy.
        
        Args:
            retention_days: Number of days to retain (defaults to settings.TICK_RETENTION_DAYS)
            
        Returns:
            Number of records deleted
        """
        if retention_days is None:
            retention_days = settings.TICK_RETENTION_DAYS
        
        cutoff_time = datetime.now() - __import__('datetime').timedelta(days=retention_days)
        return await TickHistoryDB.delete_old_ticks(cutoff_time)


# Global database instances
db = Database()
stock_db = StockRealtimeDB()
tick_history_db = TickHistoryDB()
