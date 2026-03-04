-- V12: Add board field to stock_basic table
-- This migration adds the 'board' field to distinguish between:
-- - Main Board (主板)
-- - STAR Market (科创板)
-- - ChiNext (创业板)
-- - Beijing Stock Exchange (北交所)

ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS board VARCHAR(20);

-- Update market field to support more values: SSE (上交所), SZSE (深交所), BSE (北交所)
-- Currently market is VARCHAR(20), so it's already compatible

-- Add index on board column
CREATE INDEX IF NOT EXISTS idx_stock_basic_board ON stock_basic(board);

-- Add composite index for market + board queries
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_board ON stock_basic(market, board);

-- Comments
COMMENT ON COLUMN stock_basic.board IS '上市板块: Main(主板), STAR(科创板), ChiNext(创业板), BSE(北交所)';
COMMENT ON COLUMN stock_basic.market IS '市场类型: SSE(上交所), SZSE(深交所), BSE(北交所)';
