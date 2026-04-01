-- Market daily breadth aggregate table
-- Stores per-market daily breadth counts for dashboard ratio card.

CREATE TABLE IF NOT EXISTS market_daily_breadth (
    id BIGSERIAL PRIMARY KEY,
    market VARCHAR(20) NOT NULL,
    breadth_type VARCHAR(20) NOT NULL,
    trade_date DATE NOT NULL,
    gainers INTEGER NOT NULL DEFAULT 0,
    losers INTEGER NOT NULL DEFAULT 0,
    unchanged INTEGER NOT NULL DEFAULT 0,
    suspended INTEGER,
    total_stocks INTEGER NOT NULL DEFAULT 0,
    advance_decline_line INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(50) NOT NULL,
    quality VARCHAR(20) NOT NULL DEFAULT 'OFFICIAL',
    snapshot_time TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_market_daily_breadth UNIQUE (market, breadth_type, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_market_daily_breadth_market_type_date
    ON market_daily_breadth (market, breadth_type, trade_date DESC);

COMMENT ON TABLE market_daily_breadth IS '市场日涨跌宽度聚合表（按市场/口径/交易日）';
COMMENT ON COLUMN market_daily_breadth.market IS '市场代码，如 AShare';
COMMENT ON COLUMN market_daily_breadth.breadth_type IS '宽度口径，如 ALL_A';
COMMENT ON COLUMN market_daily_breadth.trade_date IS '交易日（Asia/Shanghai）';
COMMENT ON COLUMN market_daily_breadth.gainers IS '上涨家数';
COMMENT ON COLUMN market_daily_breadth.losers IS '下跌家数';
COMMENT ON COLUMN market_daily_breadth.unchanged IS '平盘家数';
COMMENT ON COLUMN market_daily_breadth.suspended IS '停牌家数';
COMMENT ON COLUMN market_daily_breadth.total_stocks IS '统计总家数';
COMMENT ON COLUMN market_daily_breadth.advance_decline_line IS '涨跌差（上涨-下跌）';
COMMENT ON COLUMN market_daily_breadth.source IS '数据源，如 AKSHARE_MARKET_ACTIVITY_LEGU';
COMMENT ON COLUMN market_daily_breadth.quality IS '数据质量：OFFICIAL/ESTIMATED/PARTIAL';
