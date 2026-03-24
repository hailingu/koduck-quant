-- V24: Ensure stock_basic has all columns required by data-service full upsert
-- This migration is idempotent and safe for partially-initialized databases.

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

CREATE INDEX IF NOT EXISTS idx_stock_basic_board ON stock_basic(board);
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_board ON stock_basic(market, board);
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry ON stock_basic(industry);
CREATE INDEX IF NOT EXISTS idx_stock_basic_sector ON stock_basic(sector);
