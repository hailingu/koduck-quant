CREATE TABLE IF NOT EXISTS stock_tick_history (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    tick_time TIMESTAMP NOT NULL,
    price DECIMAL(18, 4) NOT NULL,
    volume BIGINT,
    amount DECIMAL(24, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_tick_history_symbol_time
    ON stock_tick_history (symbol, tick_time DESC, id DESC);
