-- Add turnover rate column used by stock valuation API.
ALTER TABLE stock_basic
    ADD COLUMN IF NOT EXISTS turnover_rate DECIMAL(10, 4);

COMMENT ON COLUMN stock_basic.turnover_rate IS '换手率(%)';

CREATE INDEX IF NOT EXISTS idx_stock_basic_turnover_rate ON stock_basic(turnover_rate);