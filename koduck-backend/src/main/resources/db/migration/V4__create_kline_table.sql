-- Kline data table for storing historical price data
-- Supports multiple markets and timeframes

CREATE TABLE IF NOT EXISTS kline_data (
    id BIGSERIAL PRIMARY KEY,
    market VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    kline_time TIMESTAMP NOT NULL,
    open_price DECIMAL(18, 8) NOT NULL,
    high_price DECIMAL(18, 8) NOT NULL,
    low_price DECIMAL(18, 8) NOT NULL,
    close_price DECIMAL(18, 8) NOT NULL,
    volume BIGINT,
    amount DECIMAL(24, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate data
    CONSTRAINT uk_kline_data UNIQUE (market, symbol, timeframe, kline_time)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_kline_market_symbol ON kline_data(market, symbol);
CREATE INDEX IF NOT EXISTS idx_kline_timeframe ON kline_data(timeframe);
CREATE INDEX IF NOT EXISTS idx_kline_time ON kline_data(kline_time);
CREATE INDEX IF NOT EXISTS idx_kline_composite ON kline_data(market, symbol, timeframe, kline_time DESC);

-- Comment for documentation
COMMENT ON TABLE kline_data IS 'Historical K-line (candlestick) data for market analysis';
COMMENT ON COLUMN kline_data.market IS 'Market type: AShare, USStock, Crypto, etc.';
COMMENT ON COLUMN kline_data.symbol IS 'Stock symbol or trading pair';
COMMENT ON COLUMN kline_data.timeframe IS 'Time period: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M';
COMMENT ON COLUMN kline_data.kline_time IS 'Timestamp of the kline period';
COMMENT ON COLUMN kline_data.open_price IS 'Opening price';
COMMENT ON COLUMN kline_data.high_price IS 'Highest price';
COMMENT ON COLUMN kline_data.low_price IS 'Lowest price';
COMMENT ON COLUMN kline_data.close_price IS 'Closing price';
COMMENT ON COLUMN kline_data.volume IS 'Trading volume';
COMMENT ON COLUMN kline_data.amount IS 'Trading amount (volume * price)';
