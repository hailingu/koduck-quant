-- ==========================================
-- Baseline migration
-- Single source of truth for schema bootstrap in the next development phase.
-- ==========================================


-- ===== BEGIN: V1__init_auth_tables.sql =====
-- 初始化认证相关表（无外键约束）
-- 表关系在应用层维护

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    avatar_url VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.status IS '状态: 0-禁用, 1-正常, 2-待验证';

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS '角色表';

-- 用户角色关联表（无外键）
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

COMMENT ON TABLE user_roles IS '用户角色关联表';

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    resource VARCHAR(50),
    action VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE permissions IS '权限表';

-- 角色权限关联表（无外键）
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS '角色权限关联表';

-- 刷新令牌表（无外键）
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

COMMENT ON TABLE refresh_tokens IS '刷新令牌表';

-- 登录尝试记录表
CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_attempts_identifier_type ON login_attempts(identifier, type);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);

COMMENT ON TABLE login_attempts IS '登录尝试记录表';

-- ===== END: V1__init_auth_tables.sql =====


-- ===== BEGIN: V1_0_0__profile_tables.sql =====
-- Issue #168: Profile 数据库模型
-- 用户表扩展
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- API密钥表
CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    permissions VARCHAR(50) DEFAULT 'readonly',
    ip_whitelist TEXT,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 登录历史表
CREATE TABLE IF NOT EXISTS login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_type VARCHAR(50),
    location VARCHAR(100),
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true
);

-- 用户偏好表
CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'zh-CN',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(10) DEFAULT '24h',
    default_kline_period VARCHAR(10) DEFAULT '1D',
    price_color_scheme VARCHAR(20) DEFAULT 'red-up',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_login_history_user_id ON login_history(user_id);
CREATE INDEX idx_login_history_login_at ON login_history(login_at);

-- ===== END: V1_0_0__profile_tables.sql =====


-- ===== BEGIN: V2__seed_auth_data.sql =====
-- 初始化角色数据
INSERT INTO roles (id, name, description) VALUES 
(1, 'ADMIN', '系统管理员'),
(2, 'USER', '普通用户')
ON CONFLICT (id) DO NOTHING;

-- 初始化权限数据
INSERT INTO permissions (id, code, name, resource, action) VALUES
(1, 'user:read', '查看用户', 'user', 'read'),
(2, 'user:write', '编辑用户', 'user', 'write'),
(3, 'user:delete', '删除用户', 'user', 'delete'),
(4, 'strategy:read', '查看策略', 'strategy', 'read'),
(5, 'strategy:write', '编辑策略', 'strategy', 'write'),
(6, 'backtest:run', '执行回测', 'backtest', 'execute'),
(7, 'market:read', '查看市场数据', 'market', 'read'),
(8, 'indicator:read', '查看指标', 'indicator', 'read'),
(9, 'indicator:write', '编辑指标', 'indicator', 'write')
ON CONFLICT (id) DO NOTHING;

-- 为 ADMIN 角色分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT DO NOTHING;

-- 为 USER 角色分配基本权限
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1),   -- user:read
(2, 4),   -- strategy:read
(2, 5),   -- strategy:write
(2, 6),   -- backtest:run
(2, 7),   -- market:read
(2, 8),   -- indicator:read
(2, 9)    -- indicator:write
ON CONFLICT DO NOTHING;

-- 注意: 演示用户现在由 DataInitializer 在应用启动时创建
-- 密码通过环境变量 APP_DEMO_PASSWORD 或 app.demo.password 配置
-- 详见: https://github.com/hailingu/koduck-quant/issues/115

-- ===== END: V2__seed_auth_data.sql =====


-- ===== BEGIN: V3__add_user_indexes.sql =====
-- 为用户表添加必要的索引
-- 用于分页查询和关键词搜索

-- 用户名模糊搜索索引
CREATE INDEX IF NOT EXISTS idx_users_username_like ON users(username varchar_pattern_ops);

-- 创建时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 状态索引（用于筛选）
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ===== END: V3__add_user_indexes.sql =====


-- ===== BEGIN: V4__create_kline_table.sql =====
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

-- ===== END: V4__create_kline_table.sql =====


-- ===== BEGIN: V5__create_watchlist_table.sql =====
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

-- ===== END: V5__create_watchlist_table.sql =====


-- ===== BEGIN: V1_0_1__tiered_watchlist.sql =====
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

-- ===== END: V1_0_1__tiered_watchlist.sql =====


-- ===== BEGIN: V6__create_user_settings.sql =====
-- ==========================================
-- 用户设置表
-- ==========================================

CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    
    -- 主题设置
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    language VARCHAR(10) NOT NULL DEFAULT 'zh-CN',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
    
    -- 通知设置 (JSON 格式存储)
    notification_config JSONB NOT NULL DEFAULT '{
        "email": true,
        "browser": true,
        "priceAlert": true,
        "tradeAlert": true,
        "strategyAlert": true
    }'::jsonb,
    
    -- 交易设置
    trading_config JSONB NOT NULL DEFAULT '{
        "defaultMarket": "US",
        "commissionRate": 0.001,
        "minCommission": 0.0,
        "enableConfirmation": true
    }'::jsonb,
    
    -- 显示设置
    display_config JSONB NOT NULL DEFAULT '{
        "currency": "USD",
        "dateFormat": "YYYY-MM-DD",
        "numberFormat": "comma",
        "compactMode": false
    }'::jsonb,
    
    -- 快捷入口 (JSON 数组)
    quick_links JSONB DEFAULT '[
        {"id": 1, "name": "自选股", "icon": "Star", "path": "/watchlist"},
        {"id": 2, "name": "投资组合", "icon": "PieChart", "path": "/portfolio"}
    ]'::jsonb,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- 添加注释
COMMENT ON TABLE user_settings IS '用户设置表';
COMMENT ON COLUMN user_settings.theme IS '主题: light, dark, auto';
COMMENT ON COLUMN user_settings.language IS '语言: zh-CN, en-US';
COMMENT ON COLUMN user_settings.notification_config IS '通知设置 JSON';
COMMENT ON COLUMN user_settings.trading_config IS '交易设置 JSON';
COMMENT ON COLUMN user_settings.display_config IS '显示设置 JSON';
COMMENT ON COLUMN user_settings.quick_links IS '快捷入口 JSON';

-- ===== END: V6__create_user_settings.sql =====


-- ===== BEGIN: V7__create_user_credentials.sql =====
-- 用户凭证表 - 用于安全存储 API Key 和 Secret
CREATE TABLE IF NOT EXISTS user_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BROKER', 'DATA_SOURCE', 'EXCHANGE', 'AI_PROVIDER')),
    provider VARCHAR(50) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT,
    environment VARCHAR(20) CHECK (environment IN ('paper', 'live', 'sandbox')),
    additional_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_verified_at TIMESTAMP,
    last_verified_status VARCHAR(20) CHECK (last_verified_status IN ('SUCCESS', 'FAILED', 'PENDING')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX idx_user_credentials_type ON user_credentials(type);
CREATE INDEX idx_user_credentials_provider ON user_credentials(provider);

-- 凭证操作审计日志表
CREATE TABLE IF NOT EXISTS credential_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    credential_id BIGINT,
    user_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VERIFY', 'VIEW')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (credential_id) REFERENCES user_credentials(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_credential_audit_logs_user_id ON credential_audit_logs(user_id);
CREATE INDEX idx_credential_audit_logs_credential_id ON credential_audit_logs(credential_id);
CREATE INDEX idx_credential_audit_logs_created_at ON credential_audit_logs(created_at);

-- 添加注释
COMMENT ON TABLE user_credentials IS '用户凭证表 - 存储加密的 API Key 和 Secret';
COMMENT ON COLUMN user_credentials.api_key_encrypted IS 'AES-256 加密的 API Key';
COMMENT ON COLUMN user_credentials.api_secret_encrypted IS 'AES-256 加密的 API Secret';
COMMENT ON COLUMN user_credentials.additional_config IS '额外配置参数（JSON 格式）';
COMMENT ON TABLE credential_audit_logs IS '凭证操作审计日志';

-- ===== END: V7__create_user_credentials.sql =====


-- ===== BEGIN: V8__create_community_signals.sql =====
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

-- ===== END: V8__create_community_signals.sql =====


-- ===== BEGIN: V9__fix_demo_user.sql =====
-- 修复演示用户数据 (已废弃)
-- 此迁移文件已废弃，演示用户现由 DataInitializer 在应用启动时创建
-- 密码通过环境变量 APP_DEMO_PASSWORD 或 app.demo.password 配置
-- 详见: https://github.com/hailingu/koduck-quant/issues/115

-- 保留 USER 角色分配逻辑，但不再处理 demo 用户
-- 1. 确保所有现有用户都有 USER 角色
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 2
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 2);

-- 2. 更新序列，确保下次插入不会冲突
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);

-- ===== END: V9__fix_demo_user.sql =====


-- ===== BEGIN: V10__create_stock_tables.sql =====
-- V10: Create stock tables for market data
-- This migration creates tables for:
-- 1. stock_realtime - Real-time price quotes
-- 2. stock_basic - Stock basic information for search
-- 3. hot_stock - Hot stocks ranking

-- Stock Realtime Table (同步 Data Service 的 stock_realtime 表)
CREATE TABLE IF NOT EXISTS stock_realtime (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL DEFAULT 'STOCK' CHECK (type IN ('STOCK', 'INDEX')),
    price DECIMAL(18, 4),
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_realtime_updated_at ON stock_realtime(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_realtime_volume ON stock_realtime(volume DESC);
CREATE INDEX IF NOT EXISTS idx_stock_realtime_change_percent ON stock_realtime(change_percent DESC);

-- Stock Basic Information Table (用于搜索功能)
CREATE TABLE IF NOT EXISTS stock_basic (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL DEFAULT 'STOCK' CHECK (type IN ('STOCK', 'INDEX')),
    market VARCHAR(20) NOT NULL,
    list_date DATE,
    delist_date DATE,
    is_hs BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (symbol, type)
);

CREATE INDEX IF NOT EXISTS idx_stock_basic_symbol ON stock_basic(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_basic_symbol_type ON stock_basic(symbol, type);
CREATE INDEX IF NOT EXISTS idx_stock_basic_type ON stock_basic(type);
CREATE INDEX IF NOT EXISTS idx_stock_basic_name ON stock_basic(name);
CREATE INDEX IF NOT EXISTS idx_stock_basic_name_search ON stock_basic USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_stock_basic_market ON stock_basic(market);

-- Hot Stock Table (热门股票排行)
CREATE TABLE IF NOT EXISTS hot_stock (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    ranking_type VARCHAR(20) NOT NULL,
    rank_position INTEGER NOT NULL,
    price DECIMAL(18, 4),
    change_percent DECIMAL(10, 4),
    volume BIGINT,
    amount DECIMAL(24, 2),
    trade_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trade_date, ranking_type, symbol)
);

CREATE INDEX IF NOT EXISTS idx_hot_stock_trade_date ON hot_stock(trade_date);
CREATE INDEX IF NOT EXISTS idx_hot_stock_ranking_type ON hot_stock(ranking_type, rank_position);
CREATE INDEX IF NOT EXISTS idx_hot_stock_symbol ON hot_stock(symbol);

-- Comments for documentation
COMMENT ON TABLE stock_realtime IS '实时行情数据表，由 Data Service 定时更新';
COMMENT ON TABLE stock_basic IS '股票基本信息表，用于搜索功能';
COMMENT ON TABLE hot_stock IS '热门股票排行表，按成交量/涨跌幅排序';

-- ===== END: V10__create_stock_tables.sql =====


-- ===== BEGIN: V10_5__create_strategy_trade_backtest_tables.sql =====
-- Supplemental tables that were historically created by ddl-auto/update.
-- Added into squashed baseline to satisfy JPA validate mode.

CREATE TABLE IF NOT EXISTS strategies (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_strategy_user ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_strategy_user_status ON strategies(user_id, status);

CREATE TABLE IF NOT EXISTS strategy_versions (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL,
    version_number INTEGER NOT NULL,
    code TEXT,
    changelog TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_version_strategy ON strategy_versions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_version_number ON strategy_versions(strategy_id, version_number);

CREATE TABLE IF NOT EXISTS strategy_parameters (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL,
    param_name VARCHAR(50) NOT NULL,
    param_type VARCHAR(20) NOT NULL,
    default_value VARCHAR(100),
    min_value DECIMAL(19, 4),
    max_value DECIMAL(19, 4),
    description TEXT,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_param_strategy ON strategy_parameters(strategy_id);

CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    market VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    trade_type VARCHAR(10) NOT NULL,
    quantity DECIMAL(19, 4) NOT NULL,
    price DECIMAL(19, 4) NOT NULL,
    amount DECIMAL(19, 4) NOT NULL,
    trade_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'SUCCESS',
    notes VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_trade_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_symbol ON trades(market, symbol);
CREATE INDEX IF NOT EXISTS idx_trade_time ON trades(trade_time);

CREATE TABLE IF NOT EXISTS portfolio_positions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    market VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    quantity DECIMAL(19, 4) NOT NULL,
    avg_cost DECIMAL(19, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_portfolio_user_symbol UNIQUE (user_id, market, symbol)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_symbol ON portfolio_positions(market, symbol);

CREATE TABLE IF NOT EXISTS backtest_results (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    strategy_id BIGINT NOT NULL,
    strategy_version INTEGER,
    market VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    timeframe VARCHAR(10) DEFAULT '1D',
    initial_capital DECIMAL(19, 4) NOT NULL,
    commission_rate DECIMAL(10, 6) DEFAULT 0.001,
    slippage DECIMAL(10, 6) DEFAULT 0.001,
    final_capital DECIMAL(19, 4),
    total_return DECIMAL(10, 4),
    annualized_return DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    total_trades INTEGER,
    winning_trades INTEGER,
    losing_trades INTEGER,
    win_rate DECIMAL(10, 4),
    avg_profit DECIMAL(19, 4),
    avg_loss DECIMAL(19, 4),
    profit_factor DECIMAL(10, 4),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_user ON backtest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_status ON backtest_results(status);

CREATE TABLE IF NOT EXISTS backtest_trades (
    id BIGSERIAL PRIMARY KEY,
    backtest_result_id BIGINT NOT NULL,
    trade_type VARCHAR(10) NOT NULL,
    trade_time TIMESTAMP NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(19, 4) NOT NULL,
    quantity DECIMAL(19, 4) NOT NULL,
    amount DECIMAL(19, 4) NOT NULL,
    commission DECIMAL(19, 4) NOT NULL,
    slippage_cost DECIMAL(19, 4) NOT NULL,
    total_cost DECIMAL(19, 4) NOT NULL,
    cash_after DECIMAL(19, 4) NOT NULL,
    position_after DECIMAL(19, 4) NOT NULL,
    pnl DECIMAL(19, 4),
    pnl_percent DECIMAL(10, 4),
    signal_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_btrade_result ON backtest_trades(backtest_result_id);
CREATE INDEX IF NOT EXISTS idx_btrade_date ON backtest_trades(trade_time);

-- ===== END: V10_5__create_strategy_trade_backtest_tables.sql =====


-- ===== BEGIN: V1_0_2__trade_status_and_notes.sql =====
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

-- ===== END: V1_0_2__trade_status_and_notes.sql =====


-- ===== BEGIN: V11__drop_stock_hot_table.sql =====
-- Drop stock_hot table as part of removing hot stock feature
-- See Issue #105: 移除热门股票功能

-- Drop the hot stock table if it exists
DROP TABLE IF EXISTS stock_hot CASCADE;

-- Drop related indexes if they exist
DROP INDEX IF EXISTS idx_stock_hot_date_type;
DROP INDEX IF EXISTS idx_stock_hot_symbol;

-- ===== END: V11__drop_stock_hot_table.sql =====


-- ===== BEGIN: V12__add_stock_basic_board.sql =====
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

-- ===== END: V12__add_stock_basic_board.sql =====


-- ===== BEGIN: V13__create_monitoring_tables.sql =====
-- V13: Create monitoring and alerting tables for data freshness
-- This migration creates tables for:
-- 1. alert_rule - Alert rule configuration
-- 2. alert_history - Alert history records
-- 3. data_source_status - Data source health status

-- Alert Rule Configuration Table
CREATE TABLE IF NOT EXISTS alert_rule (
    id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    threshold DECIMAL(18, 4) NOT NULL,
    operator VARCHAR(20) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cooldown_minutes INTEGER DEFAULT 5,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rule_type ON alert_rule(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rule_enabled ON alert_rule(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rule_severity ON alert_rule(severity);

-- Alert History Table
CREATE TABLE IF NOT EXISTS alert_history (
    id BIGSERIAL PRIMARY KEY,
    alert_rule_id BIGINT NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(18, 4),
    threshold DECIMAL(18, 4),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    notified BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);

-- Data Source Status Table
CREATE TABLE IF NOT EXISTS data_source_status (
    id BIGSERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'UNKNOWN',
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_source_status_name ON data_source_status(source_name);
CREATE INDEX IF NOT EXISTS idx_data_source_status_status ON data_source_status(status);

-- Insert default alert rules
INSERT INTO alert_rule (rule_name, rule_type, metric_name, threshold, operator, severity, cooldown_minutes, description) VALUES
    ('single_stock_delay', 'latency', 'stock_delay_seconds', 30, '>', 'WARNING', 5, '单只股票数据延迟超过30秒'),
    ('multiple_stock_delay', 'latency', 'stock_delay_percentage', 10, '>', 'CRITICAL', 5, '超过10%的股票数据延迟超过阈值'),
    ('data_source_failure', 'availability', 'consecutive_failures', 3, '>=', 'CRITICAL', 10, '数据源连续失败3次'),
    ('cache_hit_rate', 'performance', 'cache_hit_rate', 80, '<', 'WARNING', 5, '缓存命中率低于80%')
ON CONFLICT (rule_name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE alert_rule IS '告警规则配置表';
COMMENT ON TABLE alert_history IS '告警历史记录表';
COMMENT ON TABLE data_source_status IS '数据源状态监控表';

-- ===== END: V13__create_monitoring_tables.sql =====


-- ===== BEGIN: V14__create_password_reset_tokens.sql =====
-- 密码重置令牌表（无外键约束）
-- 用于存储密码重置请求的临时令牌

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS '密码重置令牌表';
COMMENT ON COLUMN password_reset_tokens.user_id IS '用户ID（应用层关联）';
COMMENT ON COLUMN password_reset_tokens.token_hash IS '令牌哈希值（存储哈希而非原始令牌）';
COMMENT ON COLUMN password_reset_tokens.expires_at IS '令牌过期时间';
COMMENT ON COLUMN password_reset_tokens.used IS '是否已使用';
COMMENT ON COLUMN password_reset_tokens.used_at IS '使用时间';

-- ===== END: V14__create_password_reset_tokens.sql =====


-- ===== BEGIN: V15__create_stock_tick_history_table.sql =====
-- V15: Create stock_tick_history table for tick-level historical data
-- This migration creates:
-- 1. stock_tick_history - Historical tick data table with monthly partitioning
-- 2. Related indexes for efficient querying
-- 3. Partition management function

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

-- ===== END: V15__create_stock_tick_history_table.sql =====


-- ===== BEGIN: V16__enhance_stock_basic.sql =====
-- V16: Enhance stock_basic table with comprehensive stock information
-- This migration adds essential dimensions for stock analysis and search

-- 1. Company basic information
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS english_name VARCHAR(200);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);

-- 2. Industry classification
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sub_industry VARCHAR(100);

-- 3. Geographic information
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS province VARCHAR(50);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS city VARCHAR(50);

-- 4. Share capital information (in ten thousands shares)
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS total_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_ratio DECIMAL(5, 4);

-- 5. Company status and lifecycle
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
-- Active: 正常交易, Suspended: 停牌, Delisted: 已退市, ST: 特别处理, *ST: 退市风险警示

-- 6. Trading classification
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shanghai_hongkong BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shenzhen_hongkong BOOLEAN DEFAULT FALSE;
-- Keep legacy is_hs for entity compatibility
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_hs BOOLEAN DEFAULT FALSE;

-- 7. Financial calendar
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS report_date DATE;
-- Last financial report date

-- 8. Stock attributes
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS stock_type VARCHAR(20) DEFAULT 'A';
-- A: A股, B: B股, H: H股, ETF, REITs, etc.

-- 9. Valuation metrics
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pe_ttm DECIMAL(12, 4);
-- 市盈率（滚动 TTM）
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pb DECIMAL(12, 4);
-- 市净率
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS ps_ttm DECIMAL(12, 4);
-- 市销率（滚动 TTM，可选）
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS market_cap DECIMAL(18, 2);
-- 总市值（亿元）
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_market_cap DECIMAL(18, 2);
-- 流通市值（亿元）

-- 9. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry ON stock_basic(industry);
CREATE INDEX IF NOT EXISTS idx_stock_basic_sector ON stock_basic(sector);
CREATE INDEX IF NOT EXISTS idx_stock_basic_province ON stock_basic(province);
CREATE INDEX IF NOT EXISTS idx_stock_basic_city ON stock_basic(city);
CREATE INDEX IF NOT EXISTS idx_stock_basic_status ON stock_basic(status);
CREATE INDEX IF NOT EXISTS idx_stock_basic_stock_type ON stock_basic(stock_type);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_sector ON stock_basic(market, sector);
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry_status ON stock_basic(industry, status);
CREATE INDEX IF NOT EXISTS idx_stock_basic_province_industry ON stock_basic(province, industry);

-- Full text search index for Chinese company names
CREATE INDEX IF NOT EXISTS idx_stock_basic_fullname_search ON stock_basic USING gin(to_tsvector('simple', COALESCE(full_name, '')));

-- Comments for documentation
COMMENT ON COLUMN stock_basic.full_name IS '公司全称';
COMMENT ON COLUMN stock_basic.english_name IS '英文名称';
COMMENT ON COLUMN stock_basic.short_name IS '股票简称（除Name外的备用简称）';
COMMENT ON COLUMN stock_basic.industry IS '所属行业（证监会行业分类）';
COMMENT ON COLUMN stock_basic.sector IS '所属板块（概念板块）';
COMMENT ON COLUMN stock_basic.sub_industry IS '子行业';
COMMENT ON COLUMN stock_basic.province IS '所属省份';
COMMENT ON COLUMN stock_basic.city IS '所属城市';
COMMENT ON COLUMN stock_basic.total_shares IS '总股本（万股）';
COMMENT ON COLUMN stock_basic.float_shares IS '流通股本（万股）';
COMMENT ON COLUMN stock_basic.float_ratio IS '流通比例（流通股本/总股本）';
COMMENT ON COLUMN stock_basic.status IS '上市状态: Active(正常), Suspended(停牌), Delisted(退市), ST, *ST';
COMMENT ON COLUMN stock_basic.is_shanghai_hongkong IS '是否沪港通标的';
COMMENT ON COLUMN stock_basic.is_shenzhen_hongkong IS '是否深港通标的';
COMMENT ON COLUMN stock_basic.report_date IS '最新财报日期';
COMMENT ON COLUMN stock_basic.stock_type IS '股票类型: A(A股), B(B股), ETF, REITs';

-- Add indexes for valuation metrics
CREATE INDEX IF NOT EXISTS idx_stock_basic_pe ON stock_basic(pe_ttm);
CREATE INDEX IF NOT EXISTS idx_stock_basic_pb ON stock_basic(pb);
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_cap ON stock_basic(market_cap);

-- Composite index for valuation screening
CREATE INDEX IF NOT EXISTS idx_stock_basic_valuation ON stock_basic(pe_ttm, pb, market_cap);

-- Comments for valuation fields
COMMENT ON COLUMN stock_basic.pe_ttm IS '市盈率(TTM)，滚动12个月';
COMMENT ON COLUMN stock_basic.pb IS '市净率';
COMMENT ON COLUMN stock_basic.ps_ttm IS '市销率(TTM)';
COMMENT ON COLUMN stock_basic.market_cap IS '总市值(亿元)';
COMMENT ON COLUMN stock_basic.float_market_cap IS '流通市值(亿元)';

-- Create a view for stock search with all relevant fields
CREATE OR REPLACE VIEW v_stock_search AS
SELECT 
    symbol,
    name,
    full_name,
    short_name,
    market,
    board,
    industry,
    sector,
    sub_industry,
    province,
    city,
    status,
    stock_type,
    is_shanghai_hongkong,
    is_shenzhen_hongkong,
    list_date,
    total_shares,
    float_shares,
    float_ratio,
    -- Concatenate all searchable fields
    to_tsvector('simple', 
        COALESCE(symbol, '') || ' ' ||
        COALESCE(name, '') || ' ' ||
        COALESCE(full_name, '') || ' ' ||
        COALESCE(short_name, '') || ' ' ||
        COALESCE(industry, '') || ' ' ||
        COALESCE(sector, '') || ' ' ||
        COALESCE(province, '') || ' ' ||
        COALESCE(city, '')
    ) AS search_vector
FROM stock_basic
WHERE status != 'Delisted';

COMMENT ON VIEW v_stock_search IS '股票搜索视图，包含所有可搜索字段';

-- ===== END: V16__enhance_stock_basic.sql =====


-- ===== BEGIN: V17__remove_stock_basic_name_fields.sql =====

-- ===== END: V17__remove_stock_basic_name_fields.sql =====


-- ===== BEGIN: V18__remove_stock_basic_name_fields.sql =====
-- Remove full_name, english_name, short_name columns from stock_basic table.
-- V17 was already applied as an empty placeholder in existing local databases,
-- so the actual DDL lives in V18 to preserve Flyway checksum compatibility.

-- Drop dependent view first
DROP VIEW IF EXISTS v_stock_search;

-- Drop dependent indexes
DROP INDEX IF EXISTS idx_stock_basic_fullname_search;

-- Remove columns
ALTER TABLE stock_basic
    DROP COLUMN IF EXISTS full_name,
    DROP COLUMN IF EXISTS english_name,
    DROP COLUMN IF EXISTS short_name;
-- ===== END: V18__remove_stock_basic_name_fields.sql =====


-- ===== BEGIN: V19__add_stock_basic_turnover_rate.sql =====
-- Add turnover rate column used by stock valuation API.
ALTER TABLE stock_basic
    ADD COLUMN IF NOT EXISTS turnover_rate DECIMAL(10, 4);

COMMENT ON COLUMN stock_basic.turnover_rate IS '换手率(%)';

CREATE INDEX IF NOT EXISTS idx_stock_basic_turnover_rate ON stock_basic(turnover_rate);
-- ===== END: V19__add_stock_basic_turnover_rate.sql =====


-- ===== BEGIN: V20__add_llm_config_to_user_settings.sql =====
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS llm_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_settings.llm_config IS '用户级大模型配置 JSON（provider/apiKey/apiBase）';

-- ===== END: V20__add_llm_config_to_user_settings.sql =====


-- ===== BEGIN: V21__create_memory_tables.sql =====
-- Memory System V2: 2-tier hybrid (chat_messages + memory_l1_summaries + memory_l2_themes)
-- Dropped: memory_l1_pages (raw compressed pages), memory_l3_keywords (inverted index)
-- See: koduck/memory/ for new implementation

CREATE TABLE IF NOT EXISTS memory_l2_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    theme_name VARCHAR(128) NOT NULL,
    display_name TEXT,
    description TEXT,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    summary_l1_ids UUID[] NOT NULL DEFAULT '{}',
    summary_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE (user_id, theme_name)
);

CREATE INDEX IF NOT EXISTS idx_memory_l2_user_theme
    ON memory_l2_themes(user_id, theme_name);

CREATE INDEX IF NOT EXISTS idx_memory_l2_keywords_gin
    ON memory_l2_themes USING GIN(keywords);

CREATE INDEX IF NOT EXISTS idx_memory_l2_expires_at
    ON memory_l2_themes(expires_at);

CREATE INDEX IF NOT EXISTS idx_l2_updated
    ON memory_l2_themes(user_id, updated_at DESC);

-- ===== END: V21__create_memory_tables.sql =====


-- ===== BEGIN: V22__create_agent_memory_chat_tables.sql =====
-- Agent memory (L1/L2) chat tables for session memory and user profile memory.
-- Keep idempotent DDL to simplify local rollback/re-run in dev environments.

CREATE TABLE IF NOT EXISTS chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_sessions_user_session UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_last_message
    ON chat_sessions(user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status
    ON chat_sessions(status);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_chat_messages_role
        CHECK (role IN ('system', 'user', 'assistant', 'tool'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session_created
    ON chat_messages(user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_memory_profile (
    user_id BIGINT PRIMARY KEY,
    risk_preference VARCHAR(64),
    watch_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_profile_updated_at
    ON user_memory_profile(updated_at DESC);

-- ===== END: V22__create_agent_memory_chat_tables.sql =====


-- ===== BEGIN: V23__ensure_stock_tick_history_table.sql =====
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

-- ===== END: V23__ensure_stock_tick_history_table.sql =====


-- ===== BEGIN: V24__ensure_stock_basic_full_columns.sql =====
-- V24: Ensure stock_basic has all columns required by data-service full upsert
-- This migration is idempotent and safe for partially-initialized databases.

-- Core columns (symbol, name, type, market)
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'STOCK' CHECK (type IN ('STOCK', 'INDEX'));
ALTER TABLE stock_basic DROP CONSTRAINT IF EXISTS stock_basic_symbol_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_basic_symbol_type ON stock_basic(symbol, type);
CREATE INDEX IF NOT EXISTS idx_stock_basic_type ON stock_basic(type);

-- Extended columns
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS board VARCHAR(20);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS sub_industry VARCHAR(100);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS province VARCHAR(50);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS city VARCHAR(50);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS total_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_shares BIGINT;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_ratio DECIMAL(5, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shanghai_hongkong BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_shenzhen_hongkong BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS is_hs BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS stock_type VARCHAR(20) DEFAULT 'A';
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pe_ttm DECIMAL(12, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS pb DECIMAL(12, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS ps_ttm DECIMAL(12, 4);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS market_cap DECIMAL(18, 2);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS float_market_cap DECIMAL(18, 2);
ALTER TABLE stock_basic ADD COLUMN IF NOT EXISTS turnover_rate DECIMAL(10, 4);

CREATE INDEX IF NOT EXISTS idx_stock_basic_board ON stock_basic(board);
CREATE INDEX IF NOT EXISTS idx_stock_basic_market_board ON stock_basic(market, board);
CREATE INDEX IF NOT EXISTS idx_stock_basic_industry ON stock_basic(industry);
CREATE INDEX IF NOT EXISTS idx_stock_basic_sector ON stock_basic(sector);

-- ===== END: V24__ensure_stock_basic_full_columns.sql =====


-- ===== BEGIN: V25__normalize_unique_constraints_for_user_tables.sql =====
-- Normalize unique constraint names to avoid Hibernate-generated name drift.

ALTER TABLE user_settings
    DROP CONSTRAINT IF EXISTS uk_user_settings_user_id,
    DROP CONSTRAINT IF EXISTS user_settings_user_id_key,
    DROP CONSTRAINT IF EXISTS uk4bos7satl9xeqd18frfeqg6tt;

ALTER TABLE user_settings
    ADD CONSTRAINT uk_user_settings_user_id UNIQUE (user_id);

ALTER TABLE user_signal_stats
    DROP CONSTRAINT IF EXISTS uk_user_signal_stats_user_id,
    DROP CONSTRAINT IF EXISTS user_signal_stats_user_id_key,
    DROP CONSTRAINT IF EXISTS uk9xeio1hswjogg0ymmw2chf9so;

ALTER TABLE user_signal_stats
    ADD CONSTRAINT uk_user_signal_stats_user_id UNIQUE (user_id);

-- ===== END: V25__normalize_unique_constraints_for_user_tables.sql =====
