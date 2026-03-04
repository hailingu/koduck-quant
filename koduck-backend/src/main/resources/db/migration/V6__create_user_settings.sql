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
