-- Issue #96: Tiered Watchlist Architecture
-- 分层自选股架构优化 - 盯盘100 + 观察1500

-- Add tracking_level column to watchlist_items table
ALTER TABLE watchlist_items 
ADD COLUMN IF NOT EXISTS tracking_level VARCHAR(10) DEFAULT 'WATCH';

-- Add constraint for valid tracking levels
ALTER TABLE watchlist_items 
ADD CONSTRAINT chk_tracking_level 
CHECK (tracking_level IN ('TRACK', 'WATCH'));

-- Create index on tracking_level for faster queries
CREATE INDEX IF NOT EXISTS idx_watchlist_tracking_level 
ON watchlist_items(tracking_level);

-- Create user tracking configuration table
CREATE TABLE IF NOT EXISTS user_tracking_config (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    max_track_stocks INT DEFAULT 100,
    max_watch_stocks INT DEFAULT 1500,
    track_update_interval INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_user_tracking_config_user_id 
ON user_tracking_config(user_id);

-- Create watchlist update log table for tracking data freshness
CREATE TABLE IF NOT EXISTS watchlist_update_log (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    tracking_level VARCHAR(10) NOT NULL,
    update_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    response_time_ms INT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for update log
CREATE INDEX IF NOT EXISTS idx_watchlist_update_log_symbol 
ON watchlist_update_log(symbol);

CREATE INDEX IF NOT EXISTS idx_watchlist_update_log_level 
ON watchlist_update_log(tracking_level);

CREATE INDEX IF NOT EXISTS idx_watchlist_update_log_created 
ON watchlist_update_log(created_at);

-- Add comment for documentation
COMMENT ON TABLE watchlist_items IS 'User watchlist with tiered tracking levels (TRACK/WATCH)';
COMMENT ON COLUMN watchlist_items.tracking_level IS 'TRACK: real-time updates (max 100), WATCH: 1-min kline (max 1500)';
COMMENT ON TABLE user_tracking_config IS 'User-specific tracking configuration';
COMMENT ON TABLE watchlist_update_log IS 'Log of watchlist data updates for monitoring';

-- Insert default tracking config for existing users
INSERT INTO user_tracking_config (user_id, max_track_stocks, max_watch_stocks, track_update_interval)
SELECT id, 100, 1500, 10 FROM users
ON CONFLICT (user_id) DO NOTHING;
