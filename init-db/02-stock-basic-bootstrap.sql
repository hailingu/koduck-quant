-- ==========================================
-- stock_basic bootstrap schema (Flyway-independent)
-- ==========================================
-- This script is executed by PostgreSQL docker-entrypoint on fresh volume init.
-- It provides a complete baseline for stock_basic so data-service full upsert
-- does not depend on Flyway migrations being enabled.

CREATE TABLE IF NOT EXISTS stock_basic (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    market VARCHAR(20) NOT NULL,
    board VARCHAR(20),
    industry VARCHAR(100),
    sector VARCHAR(100),
    sub_industry VARCHAR(100),
    province VARCHAR(50),
    city VARCHAR(50),
    total_shares BIGINT,
    float_shares BIGINT,
    float_ratio DECIMAL(5, 4),
    status VARCHAR(20) DEFAULT 'Active',
    is_shanghai_hongkong BOOLEAN DEFAULT FALSE,
    is_shenzhen_hongkong BOOLEAN DEFAULT FALSE,
    stock_type VARCHAR(20) DEFAULT 'A',
    list_date DATE,
    delist_date DATE,
    is_hs BOOLEAN DEFAULT FALSE,
    pe_ttm DECIMAL(12, 4),
    pb DECIMAL(12, 4),
    ps_ttm DECIMAL(12, 4),
    market_cap DECIMAL(18, 2),
    float_market_cap DECIMAL(18, 2),
    turnover_rate DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent compatibility patch for environments where stock_basic was
-- previously created with a reduced column set.
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS board VARCHAR(20);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sub_industry VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS province VARCHAR(50);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS city VARCHAR(50);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS total_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_ratio DECIMAL(5, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shanghai_hongkong BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shenzhen_hongkong BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS stock_type VARCHAR(20) DEFAULT 'A';
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pe_ttm DECIMAL(12, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pb DECIMAL(12, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS ps_ttm DECIMAL(12, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS market_cap DECIMAL(18, 2);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_market_cap DECIMAL(18, 2);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS turnover_rate DECIMAL(10, 4);

CREATE INDEX IF NOT EXISTS idx_stock_basic_symbol ON stock_basic(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_basic_name ON stock_basic(name);
CREATE INDEX IF NOT EXISTS idx_stock_basic_market ON stock_basic(market);
CREATE INDEX IF NOT EXISTS idx_stock_basic_board ON stock_basic(board);
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_board ON stock_basic(market, board);
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry ON stock_basic(industry);
CREATE INDEX IF NOT EXISTS idx_stock_basic_sector ON stock_basic(sector);
