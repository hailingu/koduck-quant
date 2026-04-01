-- Market daily net flow aggregate table
-- Stores per-market, per-flow-type daily snapshot metrics for dashboard indicators.

CREATE TABLE IF NOT EXISTS market_daily_net_flow (
    id BIGSERIAL PRIMARY KEY,
    market VARCHAR(20) NOT NULL,
    flow_type VARCHAR(20) NOT NULL,
    trade_date DATE NOT NULL,
    net_inflow DECIMAL(20, 2) NOT NULL DEFAULT 0,
    total_inflow DECIMAL(20, 2),
    total_outflow DECIMAL(20, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
    source VARCHAR(50) NOT NULL,
    quality VARCHAR(20) NOT NULL DEFAULT 'ESTIMATED',
    snapshot_time TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_market_daily_net_flow UNIQUE (market, flow_type, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_market_daily_net_flow_market_flow_date
    ON market_daily_net_flow (market, flow_type, trade_date DESC);

COMMENT ON TABLE market_daily_net_flow IS '市场日资金流聚合表（按市场/口径/交易日）';
COMMENT ON COLUMN market_daily_net_flow.market IS '市场代码，如 AShare';
COMMENT ON COLUMN market_daily_net_flow.flow_type IS '资金流口径，如 MAIN_FORCE';
COMMENT ON COLUMN market_daily_net_flow.trade_date IS '交易日（Asia/Shanghai）';
COMMENT ON COLUMN market_daily_net_flow.net_inflow IS '当日净流入（元）';
COMMENT ON COLUMN market_daily_net_flow.total_inflow IS '当日流入（元）';
COMMENT ON COLUMN market_daily_net_flow.total_outflow IS '当日流出（元）';
COMMENT ON COLUMN market_daily_net_flow.source IS '数据源，如 AKSHARE';
COMMENT ON COLUMN market_daily_net_flow.quality IS '数据质量：OFFICIAL/ESTIMATED/FALLBACK';
