-- Market sector net-flow snapshot table
-- Stores per-market, per-indicator, per-sector-type net-flow metrics for dashboard Capital River.

CREATE TABLE IF NOT EXISTS market_sector_net_flow (
    id BIGSERIAL PRIMARY KEY,
    market VARCHAR(20) NOT NULL,
    indicator VARCHAR(20) NOT NULL,
    trade_date DATE NOT NULL,
    sector_type VARCHAR(20) NOT NULL,
    sector_name VARCHAR(100) NOT NULL,
    main_force_net DECIMAL(20, 2) NOT NULL DEFAULT 0,
    retail_net DECIMAL(20, 2) NOT NULL DEFAULT 0,
    super_big_net DECIMAL(20, 2),
    big_net DECIMAL(20, 2),
    medium_net DECIMAL(20, 2),
    small_net DECIMAL(20, 2),
    change_pct DECIMAL(10, 4),
    source VARCHAR(50) NOT NULL,
    quality VARCHAR(20) NOT NULL DEFAULT 'OFFICIAL',
    snapshot_time TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_market_sector_net_flow UNIQUE (market, indicator, trade_date, sector_type, sector_name)
);

CREATE INDEX IF NOT EXISTS idx_market_sector_net_flow_market_indicator_date
    ON market_sector_net_flow (market, indicator, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_market_sector_net_flow_sector_type
    ON market_sector_net_flow (sector_type, trade_date DESC);

COMMENT ON TABLE market_sector_net_flow IS '市场板块净流向快照表（行业/概念/地域）';
COMMENT ON COLUMN market_sector_net_flow.market IS '市场代码，如 AShare';
COMMENT ON COLUMN market_sector_net_flow.indicator IS '统计周期，如 TODAY/5D/10D';
COMMENT ON COLUMN market_sector_net_flow.trade_date IS '交易日（Asia/Shanghai）';
COMMENT ON COLUMN market_sector_net_flow.sector_type IS '板块类型：industry/concept/region';
COMMENT ON COLUMN market_sector_net_flow.sector_name IS '板块名称';
COMMENT ON COLUMN market_sector_net_flow.main_force_net IS '主力净流入净额（元）';
COMMENT ON COLUMN market_sector_net_flow.retail_net IS '散户净流入净额（中单+小单，元）';
COMMENT ON COLUMN market_sector_net_flow.super_big_net IS '超大单净流入净额（元）';
COMMENT ON COLUMN market_sector_net_flow.big_net IS '大单净流入净额（元）';
COMMENT ON COLUMN market_sector_net_flow.medium_net IS '中单净流入净额（元）';
COMMENT ON COLUMN market_sector_net_flow.small_net IS '小单净流入净额（元）';
COMMENT ON COLUMN market_sector_net_flow.change_pct IS '当日涨跌幅（%）';
COMMENT ON COLUMN market_sector_net_flow.source IS '数据源，如 AKSHARE_STOCK_SECTOR_FUND_FLOW_RANK';
COMMENT ON COLUMN market_sector_net_flow.quality IS '数据质量：OFFICIAL/ESTIMATED/PARTIAL';
