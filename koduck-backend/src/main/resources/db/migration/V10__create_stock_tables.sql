-- V10: Create stock tables for market data
-- This migration creates tables for:
-- 1. stock_realtime - Real-time price quotes
-- 2. stock_basic - Stock basic information for search
-- 3. hot_stock - Hot stocks ranking

-- Stock Realtime Table (同步 Data Service 的 stock_realtime 表)
CREATE TABLE IF NOT EXISTS stock_realtime (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(18, 4),
    open_price DECIMAL(18, 4),
    high DECIMAL(18, 4),
    low DECIMAL(18, 4),
    prev_close DECIMAL(18, 4),
    volume BIGINT,
    amount DECIMAL(24, 2),
    change_amount DECIMAL(18, 4),
    change_percent DECIMAL(10, 4),
    bid_price DECIMAL(18, 4),
    bid_volume BIGINT,
    ask_price DECIMAL(18, 4),
    ask_volume BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_realtime_updated_at ON stock_realtime(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_realtime_volume ON stock_realtime(volume DESC);
CREATE INDEX IF NOT EXISTS idx_stock_realtime_change_percent ON stock_realtime(change_percent DESC);

-- Stock Basic Information Table (用于搜索功能)
CREATE TABLE IF NOT EXISTS stock_basic (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    market VARCHAR(20) NOT NULL,
    list_date DATE,
    delist_date DATE,
    is_hs BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_basic_symbol ON stock_basic(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_basic_name ON stock_basic(name);
CREATE INDEX IF NOT EXISTS idx_stock_basic_name_search ON stock_basic USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_stock_basic_market ON stock_basic(market);

-- Hot Stock Table (热门股票排行)
CREATE TABLE IF NOT EXISTS hot_stock (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    ranking_type VARCHAR(20) NOT NULL,
    rank_position INTEGER NOT NULL,
    price DECIMAL(18, 4),
    change_percent DECIMAL(10, 4),
    volume BIGINT,
    amount DECIMAL(24, 2),
    trade_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trade_date, ranking_type, symbol)
);

CREATE INDEX IF NOT EXISTS idx_hot_stock_trade_date ON hot_stock(trade_date);
CREATE INDEX IF NOT EXISTS idx_hot_stock_ranking_type ON hot_stock(ranking_type, rank_position);
CREATE INDEX IF NOT EXISTS idx_hot_stock_symbol ON hot_stock(symbol);

-- Comments for documentation
COMMENT ON TABLE stock_realtime IS '实时行情数据表，由 Data Service 定时更新';
COMMENT ON TABLE stock_basic IS '股票基本信息表，用于搜索功能';
COMMENT ON TABLE hot_stock IS '热门股票排行表，按成交量/涨跌幅排序';
