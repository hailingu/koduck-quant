-- Watchlist (自选股) table for user stock tracking

CREATE TABLE IF NOT EXISTS watchlist_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    market VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one user can only have one entry for a symbol
    CONSTRAINT uk_watchlist_user_symbol UNIQUE (user_id, market, symbol),
    
    -- Foreign key to users table
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON watchlist_items(market, symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_sort ON watchlist_items(user_id, sort_order);

-- Comments for documentation
COMMENT ON TABLE watchlist_items IS 'User watchlist (自选股) items';
COMMENT ON COLUMN watchlist_items.user_id IS 'Reference to users.id';
COMMENT ON COLUMN watchlist_items.market IS 'Market type: AShare, USStock, Crypto, etc.';
COMMENT ON COLUMN watchlist_items.symbol IS 'Stock symbol or trading pair';
COMMENT ON COLUMN watchlist_items.name IS 'Stock name (cached at creation)';
COMMENT ON COLUMN watchlist_items.sort_order IS 'Display order within user list';
COMMENT ON COLUMN watchlist_items.notes IS 'User notes for this stock';
