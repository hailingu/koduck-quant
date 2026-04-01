-- Add extra kline dimensions for daily bars
-- pre_close_price: previous close
-- is_suspended: suspension status (1 suspended, 0 active)

ALTER TABLE kline_data
    ADD COLUMN IF NOT EXISTS pre_close_price DECIMAL(18, 8);

ALTER TABLE kline_data
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
