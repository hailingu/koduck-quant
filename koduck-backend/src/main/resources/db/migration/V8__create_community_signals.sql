-- 社区信号表
CREATE TABLE IF NOT EXISTS community_signals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    strategy_id BIGINT,
    symbol VARCHAR(20) NOT NULL,
    signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
    reason TEXT NOT NULL,
    target_price DECIMAL(19, 4),
    stop_loss DECIMAL(19, 4),
    time_frame VARCHAR(20), -- 时间周期: 1d, 1w, 1m
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'EXPIRED', 'CANCELLED')),
    result_status VARCHAR(20) CHECK (result_status IN ('PENDING', 'HIT_TARGET', 'HIT_STOP', 'TIMEOUT')),
    result_profit DECIMAL(19, 4),
    expires_at TIMESTAMP,
    like_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    subscribe_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_community_signals_user_id ON community_signals(user_id);
CREATE INDEX idx_community_signals_strategy_id ON community_signals(strategy_id);
CREATE INDEX idx_community_signals_symbol ON community_signals(symbol);
CREATE INDEX idx_community_signals_signal_type ON community_signals(signal_type);
CREATE INDEX idx_community_signals_status ON community_signals(status);
CREATE INDEX idx_community_signals_created_at ON community_signals(created_at DESC);
CREATE INDEX idx_community_signals_is_featured ON community_signals(is_featured);

-- 信号订阅表
CREATE TABLE IF NOT EXISTS signal_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    notify_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signal_id) REFERENCES community_signals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(signal_id, user_id)
);

CREATE INDEX idx_signal_subscriptions_signal_id ON signal_subscriptions(signal_id);
CREATE INDEX idx_signal_subscriptions_user_id ON signal_subscriptions(user_id);

-- 信号点赞表
CREATE TABLE IF NOT EXISTS signal_likes (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signal_id) REFERENCES community_signals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(signal_id, user_id)
);

CREATE INDEX idx_signal_likes_signal_id ON signal_likes(signal_id);
CREATE INDEX idx_signal_likes_user_id ON signal_likes(user_id);

-- 信号收藏表
CREATE TABLE IF NOT EXISTS signal_favorites (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signal_id) REFERENCES community_signals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(signal_id, user_id)
);

CREATE INDEX idx_signal_favorites_signal_id ON signal_favorites(signal_id);
CREATE INDEX idx_signal_favorites_user_id ON signal_favorites(user_id);

-- 信号评论表
CREATE TABLE IF NOT EXISTS signal_comments (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_id BIGINT,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signal_id) REFERENCES community_signals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES signal_comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_signal_comments_signal_id ON signal_comments(signal_id);
CREATE INDEX idx_signal_comments_user_id ON signal_comments(user_id);
CREATE INDEX idx_signal_comments_parent_id ON signal_comments(parent_id);
CREATE INDEX idx_signal_comments_created_at ON signal_comments(created_at DESC);

-- 用户信号统计表（用于缓存用户历史准确率）
CREATE TABLE IF NOT EXISTS user_signal_stats (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    total_signals INTEGER DEFAULT 0,
    win_signals INTEGER DEFAULT 0,
    loss_signals INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2),
    avg_profit DECIMAL(19, 4),
    follower_count INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_signal_stats_user_id ON user_signal_stats(user_id);

-- 添加注释
COMMENT ON TABLE community_signals IS '社区交易信号表';
COMMENT ON COLUMN community_signals.signal_type IS '信号类型: BUY/SELL/HOLD';
COMMENT ON COLUMN community_signals.confidence IS '信心指数 0-100';
COMMENT ON COLUMN community_signals.result_status IS '结果状态: PENDING/HIT_TARGET/HIT_STOP/TIMEOUT';
COMMENT ON COLUMN community_signals.tags IS '标签数组 JSON';

COMMENT ON TABLE signal_subscriptions IS '信号订阅关系表';
COMMENT ON TABLE signal_likes IS '信号点赞表';
COMMENT ON TABLE signal_favorites IS '信号收藏表';
COMMENT ON TABLE signal_comments IS '信号评论表';
COMMENT ON TABLE user_signal_stats IS '用户信号统计表';
