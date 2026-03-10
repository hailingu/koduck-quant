-- V16: Enhance stock_basic table with comprehensive stock information
-- This migration adds essential dimensions for stock analysis and search

-- 1. Company basic information
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS english_name VARCHAR(200);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);

-- 2. Industry classification
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sub_industry VARCHAR(100);

-- 3. Geographic information
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS province VARCHAR(50);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS city VARCHAR(50);

-- 4. Share capital information (in ten thousands shares)
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS total_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_ratio DECIMAL(5, 4);

-- 5. Company status and lifecycle
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
-- Active: 正常交易, Suspended: 停牌, Delisted: 已退市, ST: 特别处理, *ST: 退市风险警示

-- 6. Trading classification
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shanghai_hongkong BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shenzhen_hongkong BOOLEAN DEFAULT FALSE;
-- Rename is_hs to more specific fields
ALTER TABLE stock_basic DROP COLUMN IF EXISTS is_hs;

-- 7. Financial calendar
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS report_date DATE;
-- Last financial report date

-- 8. Stock attributes
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS stock_type VARCHAR(20) DEFAULT 'A';
-- A: A股, B: B股, H: H股, ETF, REITs, etc.

-- 9. Valuation metrics
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pe_ttm DECIMAL(12, 4);
-- 市盈率（滚动 TTM）
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pb DECIMAL(12, 4);
-- 市净率
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS ps_ttm DECIMAL(12, 4);
-- 市销率（滚动 TTM，可选）
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS market_cap DECIMAL(18, 2);
-- 总市值（亿元）
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_market_cap DECIMAL(18, 2);
-- 流通市值（亿元）

-- 9. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry ON stock_basic(industry);
CREATE INDEX IF NOT EXISTS idx_stock_basic_sector ON stock_basic(sector);
CREATE INDEX IF NOT EXISTS idx_stock_basic_province ON stock_basic(province);
CREATE INDEX IF NOT EXISTS idx_stock_basic_city ON stock_basic(city);
CREATE INDEX IF NOT EXISTS idx_stock_basic_status ON stock_basic(status);
CREATE INDEX IF NOT EXISTS idx_stock_basic_stock_type ON stock_basic(stock_type);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_sector ON stock_basic(market, sector);
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry_status ON stock_basic(industry, status);
CREATE INDEX IF NOT EXISTS idx_stock_basic_province_industry ON stock_basic(province, industry);

-- Full text search index for Chinese company names
CREATE INDEX IF NOT EXISTS idx_stock_basic_fullname_search ON stock_basic USING gin(to_tsvector('simple', COALESCE(full_name, '')));

-- Comments for documentation
COMMENT ON COLUMN stock_basic.full_name IS '公司全称';
COMMENT ON COLUMN stock_basic.english_name IS '英文名称';
COMMENT ON COLUMN stock_basic.short_name IS '股票简称（除Name外的备用简称）';
COMMENT ON COLUMN stock_basic.industry IS '所属行业（证监会行业分类）';
COMMENT ON COLUMN stock_basic.sector IS '所属板块（概念板块）';
COMMENT ON COLUMN stock_basic.sub_industry IS '子行业';
COMMENT ON COLUMN stock_basic.province IS '所属省份';
COMMENT ON COLUMN stock_basic.city IS '所属城市';
COMMENT ON COLUMN stock_basic.total_shares IS '总股本（万股）';
COMMENT ON COLUMN stock_basic.float_shares IS '流通股本（万股）';
COMMENT ON COLUMN stock_basic.float_ratio IS '流通比例（流通股本/总股本）';
COMMENT ON COLUMN stock_basic.status IS '上市状态: Active(正常), Suspended(停牌), Delisted(退市), ST, *ST';
COMMENT ON COLUMN stock_basic.is_shanghai_hongkong IS '是否沪港通标的';
COMMENT ON COLUMN stock_basic.is_shenzhen_hongkong IS '是否深港通标的';
COMMENT ON COLUMN stock_basic.report_date IS '最新财报日期';
COMMENT ON COLUMN stock_basic.stock_type IS '股票类型: A(A股), B(B股), ETF, REITs';

-- Add indexes for valuation metrics
CREATE INDEX IF NOT EXISTS idx_stock_basic_pe ON stock_basic(pe_ttm);
CREATE INDEX IF NOT EXISTS idx_stock_basic_pb ON stock_basic(pb);
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_cap ON stock_basic(market_cap);

-- Composite index for valuation screening
CREATE INDEX IF NOT EXISTS idx_stock_basic_valuation ON stock_basic(pe_ttm, pb, market_cap);

-- Comments for valuation fields
COMMENT ON COLUMN stock_basic.pe_ttm IS '市盈率(TTM)，滚动12个月';
COMMENT ON COLUMN stock_basic.pb IS '市净率';
COMMENT ON COLUMN stock_basic.ps_ttm IS '市销率(TTM)';
COMMENT ON COLUMN stock_basic.market_cap IS '总市值(亿元)';
COMMENT ON COLUMN stock_basic.float_market_cap IS '流通市值(亿元)';

-- Create a view for stock search with all relevant fields
CREATE OR REPLACE VIEW v_stock_search AS
SELECT 
    symbol,
    name,
    full_name,
    short_name,
    market,
    board,
    industry,
    sector,
    sub_industry,
    province,
    city,
    status,
    stock_type,
    is_shanghai_hongkong,
    is_shenzhen_hongkong,
    list_date,
    total_shares,
    float_shares,
    float_ratio,
    -- Concatenate all searchable fields
    to_tsvector('simple', 
        COALESCE(symbol, '') || ' ' ||
        COALESCE(name, '') || ' ' ||
        COALESCE(full_name, '') || ' ' ||
        COALESCE(short_name, '') || ' ' ||
        COALESCE(industry, '') || ' ' ||
        COALESCE(sector, '') || ' ' ||
        COALESCE(province, '') || ' ' ||
        COALESCE(city, '')
    ) AS search_vector
FROM stock_basic
WHERE status != 'Delisted';

COMMENT ON VIEW v_stock_search IS '股票搜索视图，包含所有可搜索字段';
