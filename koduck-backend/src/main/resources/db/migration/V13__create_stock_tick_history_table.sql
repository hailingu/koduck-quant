-- V13: Create stock_tick_history table for tick-level historical data
-- This migration creates:
-- 1. stock_tick_history - Historical tick data table with monthly partitioning
-- 2. Related indexes for efficient querying
-- 3. Partition management function

-- Enable required extension for partition management
CREATE EXTENSION IF NOT EXISTS "pg_partman";

-- ==========================================
-- Main Table: stock_tick_history
-- ==========================================
-- Using native PostgreSQL declarative partitioning by month
CREATE TABLE IF NOT EXISTS stock_tick_history (
    id BIGSERIAL,
    symbol VARCHAR(20) NOT NULL,
    tick_time TIMESTAMP WITH TIME ZONE NOT NULL,
    price DECIMAL(18, 4) NOT NULL,
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
    -- Extended fields for raw data storage
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Primary key includes partition key
    PRIMARY KEY (id, tick_time)
) PARTITION BY RANGE (tick_time);

-- Create initial partitions (current month and next 3 months)
-- Note: Partition creation is handled by a maintenance function

-- ==========================================
-- Indexes
-- ==========================================
-- Core index for symbol + time range queries (most common)
CREATE INDEX IF NOT EXISTS idx_stock_tick_symbol_time 
    ON stock_tick_history (symbol, tick_time);

-- Index for time-based queries and partition pruning
CREATE INDEX IF NOT EXISTS idx_stock_tick_time 
    ON stock_tick_history (tick_time);

-- Index for symbol-only queries
CREATE INDEX IF NOT EXISTS idx_stock_tick_symbol 
    ON stock_tick_history (symbol);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_stock_tick_symbol_price_time 
    ON stock_tick_history (symbol, price, tick_time);

-- GIN index for raw_data JSONB queries
CREATE INDEX IF NOT EXISTS idx_stock_tick_raw_data 
    ON stock_tick_history USING GIN (raw_data);

-- ==========================================
-- Partition Management
-- ==========================================
-- Function to create monthly partitions
CREATE OR REPLACE FUNCTION create_tick_history_partition(
    p_year INTEGER,
    p_month INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
    create_sql TEXT;
BEGIN
    partition_date := make_date(p_year, p_month, 1);
    partition_name := 'stock_tick_history_' || to_char(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';
    
    -- Check if partition already exists
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = partition_name 
        AND schemaname = 'public'
    ) THEN
        RETURN 'Partition ' || partition_name || ' already exists';
    END IF;
    
    -- Create partition
    create_sql := format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF stock_tick_history
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
    );
    
    EXECUTE create_sql;
    
    -- Create indexes on partition
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (symbol, tick_time)',
        partition_name || '_symbol_time_idx',
        partition_name
    );
    
    RETURN 'Created partition: ' || partition_name;
END;
$$;

-- Function to create partitions for a date range
CREATE OR REPLACE FUNCTION create_tick_history_partitions(
    months_ahead INTEGER DEFAULT 3
) RETURNS TABLE(result TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    current_month DATE;
    i INTEGER;
    year_num INTEGER;
    month_num INTEGER;
    result_msg TEXT;
BEGIN
    current_month := date_trunc('month', CURRENT_DATE);
    
    FOR i IN 0..months_ahead LOOP
        year_num := EXTRACT(YEAR FROM current_month + (i || ' months')::INTERVAL)::INTEGER;
        month_num := EXTRACT(MONTH FROM current_month + (i || ' months')::INTERVAL)::INTEGER;
        result_msg := create_tick_history_partition(year_num, month_num);
        RETURN QUERY SELECT result_msg;
    END LOOP;
END;
$$;

-- Function to drop old partitions (for data retention)
CREATE OR REPLACE FUNCTION drop_old_tick_history_partitions(
    retention_months INTEGER DEFAULT 3
) RETURNS TABLE(result TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    cutoff_date DATE;
    partition_record RECORD;
    drop_sql TEXT;
BEGIN
    cutoff_date := date_trunc('month', CURRENT_DATE - (retention_months || ' months')::INTERVAL);
    
    FOR partition_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'stock_tick_history_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name
        DECLARE
            partition_year INTEGER;
            partition_month INTEGER;
            partition_date DATE;
        BEGIN
            partition_year := substring(partition_record.tablename from 'stock_tick_history_(\\d{4})_(\\d{2})')::INTEGER;
            partition_month := substring(partition_record.tablename from 'stock_tick_history_\\d{4}_(\\d{2})')::INTEGER;
            partition_date := make_date(partition_year, partition_month, 1);
            
            IF partition_date < cutoff_date THEN
                drop_sql := format('DROP TABLE IF EXISTS %I', partition_record.tablename);
                EXECUTE drop_sql;
                result := 'Dropped partition: ' || partition_record.tablename;
                RETURN NEXT;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip if date parsing fails
            CONTINUE;
        END;
    END LOOP;
END;
$$;

-- ==========================================
-- Initial Partitions
-- ==========================================
-- Create partitions for current month and next 3 months
SELECT * FROM create_tick_history_partitions(3);

-- ==========================================
-- Comments
-- ==========================================
COMMENT ON TABLE stock_tick_history IS '股票历史 tick 数据表，按月分区存储';
COMMENT ON COLUMN stock_tick_history.symbol IS '股票代码';
COMMENT ON COLUMN stock_tick_history.tick_time IS 'Tick 时间戳';
COMMENT ON COLUMN stock_tick_history.price IS '最新价格';
COMMENT ON COLUMN stock_tick_history.volume IS '成交量';
COMMENT ON COLUMN stock_tick_history.amount IS '成交金额';
COMMENT ON COLUMN stock_tick_history.raw_data IS '原始完整数据(JSONB格式)';

-- ==========================================
-- Statistics for query optimizer
-- ==========================================
ANALYZE stock_tick_history;
