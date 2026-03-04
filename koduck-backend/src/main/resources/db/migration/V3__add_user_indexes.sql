-- 为用户表添加必要的索引
-- 用于分页查询和关键词搜索

-- 用户名模糊搜索索引
CREATE INDEX IF NOT EXISTS idx_users_username_like ON users(username varchar_pattern_ops);

-- 创建时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 状态索引（用于筛选）
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
