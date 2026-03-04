"""Database connection and operations for PostgreSQL."""

import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

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

INSERT_STOCK_BASIC = """
INSERT INTO stock_basic (symbol, name, market, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW()
"""

SELECT_STOCK_REALTIME = """
SELECT symbol, name, price, open_price, high, low, prev_close,
       volume, amount, change_amount, change_percent,
       bid_price, bid_volume, ask_price, ask_volume, updated_at
FROM stock_realtime WHERE symbol = $1
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


# Global database instance
db = Database()
stock_db = StockRealtimeDB()
