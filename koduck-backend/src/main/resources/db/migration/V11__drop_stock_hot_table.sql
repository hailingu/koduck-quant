-- Drop stock_hot table as part of removing hot stock feature
-- See Issue #105: 移除热门股票功能

-- Drop the hot stock table if it exists
DROP TABLE IF EXISTS stock_hot CASCADE;

-- Drop related indexes if they exist
DROP INDEX IF EXISTS idx_stock_hot_date_type;
DROP INDEX IF EXISTS idx_stock_hot_symbol;
