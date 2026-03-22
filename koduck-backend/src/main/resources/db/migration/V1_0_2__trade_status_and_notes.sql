-- Issue #210: Trade 记录支持 status 字段
-- Add status and notes columns to trades table
-- Note: This migration depends on V10__create_stock_tables.sql

-- Only run if trades table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
        -- Add status column with default value SUCCESS
        ALTER TABLE trades 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'SUCCESS';

        -- Add notes column for trade remarks
        ALTER TABLE trades 
        ADD COLUMN IF NOT EXISTS notes VARCHAR(500);

        -- Add index on status for filtering
        CREATE INDEX IF NOT EXISTS idx_trade_status ON trades(status);

        -- Add comments
        COMMENT ON COLUMN trades.status IS '交易状态: PENDING(待执行), SUCCESS(成功), FAILED(失败), CANCELLED(已取消)';
        COMMENT ON COLUMN trades.notes IS '交易备注/说明';

        -- Update existing records to have SUCCESS status
        UPDATE trades SET status = 'SUCCESS' WHERE status IS NULL;
    END IF;
END $$;
