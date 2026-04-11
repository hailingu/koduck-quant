-- Memory System V2 Database Migration
-- 创建价值分层记忆系统的数据库表

-- ============================================
-- 1. L1 Summaries: 高价值会话摘要表
-- ============================================
CREATE TABLE IF NOT EXISTS memory_l1_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    
    -- 核心内容
    summary TEXT NOT NULL,
    summary_detail TEXT,
    key_points TEXT[],
    
    -- 来源关联
    source_message_ids BIGINT[],
    message_count INTEGER DEFAULT 0,
    chat_digest TEXT,
    
    -- 价值评分 (核心)
    value_score FLOAT NOT NULL DEFAULT 0,
    value_importance FLOAT DEFAULT 0,
    value_density FLOAT DEFAULT 0,
    value_timeliness FLOAT DEFAULT 0,
    value_novelty FLOAT DEFAULT 0,
    value_intent FLOAT DEFAULT 0,
    
    -- 分类标签
    summary_type VARCHAR(32) DEFAULT 'general',
    category_tags TEXT[],
    
    -- 结构化实体
    extracted_entities JSONB DEFAULT '[]'::jsonb,
    
    -- 生命周期
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    -- 状态管理
    status VARCHAR(16) DEFAULT 'active',
    is_pinned BOOLEAN DEFAULT false,
    is_user_edited BOOLEAN DEFAULT false,
    is_auto_generated BOOLEAN DEFAULT true,
    
    -- 统计
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    
    -- 元数据
    meta JSONB DEFAULT '{}'::jsonb,
    
    -- 约束
    CONSTRAINT valid_value_score CHECK (value_score >= 0 AND value_score <= 1),
    UNIQUE(user_id, session_id)
);

-- L1 表核心索引
CREATE INDEX IF NOT EXISTS idx_l1_user_score 
ON memory_l1_summaries(user_id, value_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_l1_user_pinned 
ON memory_l1_summaries(user_id, is_pinned, value_score DESC);

CREATE INDEX IF NOT EXISTS idx_l1_user_type 
ON memory_l1_summaries(user_id, summary_type, value_score DESC);

CREATE INDEX IF NOT EXISTS idx_l1_expires 
ON memory_l1_summaries(expires_at) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_l1_entities 
ON memory_l1_summaries USING GIN(extracted_entities jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_l1_tags 
ON memory_l1_summaries USING GIN(category_tags);

-- 注释
COMMENT ON TABLE memory_l1_summaries IS '高价值会话摘要表，存储经AI摘要后的精华内容';
COMMENT ON COLUMN memory_l1_summaries.value_score IS '综合价值评分0-1，决定记忆保留优先级';
COMMENT ON COLUMN memory_l1_summaries.expires_at IS '根据value_score动态计算，高分记忆保留更久';

-- ============================================
-- 2. L2 Themes: 主题聚合表
-- ============================================
CREATE TABLE IF NOT EXISTS memory_l2_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    
    -- 主题标识
    theme_name TEXT NOT NULL,
    display_name TEXT,
    theme_description TEXT,
    
    -- 关键词
    keywords TEXT[],
    related_keywords TEXT[],
    
    -- 关联记忆
    summary_l1_ids UUID[],
    summary_count INTEGER DEFAULT 0,
    
    -- 聚合内容
    aggregated_summary TEXT,
    key_decisions JSONB,
    
    -- 时间
    first_seen_at TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 统计
    access_count INTEGER DEFAULT 0,
    
    UNIQUE(user_id, theme_name)
);

-- L2 表索引
CREATE INDEX IF NOT EXISTS idx_l2_user 
ON memory_l2_themes(user_id);

CREATE INDEX IF NOT EXISTS idx_l2_keywords 
ON memory_l2_themes USING GIN(keywords);

CREATE INDEX IF NOT EXISTS idx_l2_updated 
ON memory_l2_themes(user_id, last_updated_at DESC);

COMMENT ON TABLE memory_l2_themes IS '主题聚合表，用于跨会话的知识组织和快速检索';

-- ============================================
-- 3. Memory Access Log: 访问日志表 (可选)
-- ============================================
CREATE TABLE IF NOT EXISTS memory_access_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_id TEXT,
    query_text TEXT,
    retrieved_l1_ids UUID[],
    retrieval_time_ms INTEGER,
    context_injected BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mal_user 
ON memory_access_log(user_id, created_at DESC);

COMMENT ON TABLE memory_access_log IS '记忆访问日志，用于分析检索质量和优化';

-- ============================================
-- 4. 修改 chat_messages 表 (如果存在)
-- ============================================
DO $$
BEGIN
    -- 添加 has_summary 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'has_summary'
    ) THEN
        ALTER TABLE chat_messages 
        ADD COLUMN has_summary BOOLEAN DEFAULT false;
    END IF;
    
    -- 添加 summary_id 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'summary_id'
    ) THEN
        ALTER TABLE chat_messages 
        ADD COLUMN summary_id UUID;
    END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cm_has_summary 
ON chat_messages(has_summary) 
WHERE has_summary = false;

-- ============================================
-- 5. 创建更新触发器 (自动更新 updated_at)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 L1 表创建触发器
DROP TRIGGER IF EXISTS update_l1_updated_at ON memory_l1_summaries;
CREATE TRIGGER update_l1_updated_at
    BEFORE UPDATE ON memory_l1_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 L2 表创建触发器
DROP TRIGGER IF EXISTS update_l2_updated_at ON memory_l2_themes;
CREATE TRIGGER update_l2_updated_at
    BEFORE UPDATE ON memory_l2_themes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 创建常用查询视图
-- ============================================

-- 用户记忆统计视图
CREATE OR REPLACE VIEW v_user_memory_stats AS
SELECT 
    user_id,
    COUNT(*) as total_memories,
    COUNT(*) FILTER (WHERE status = 'active') as active_memories,
    AVG(value_score) as avg_score,
    COUNT(*) FILTER (WHERE value_score >= 0.7) as high_value_count,
    COUNT(*) FILTER (WHERE is_pinned) as pinned_count,
    COUNT(*) FILTER (WHERE summary_type = 'decision') as decision_count,
    COUNT(*) FILTER (WHERE summary_type = 'task') as task_count,
    MAX(created_at) as last_created_at
FROM memory_l1_summaries
GROUP BY user_id;

-- 主题统计视图
CREATE OR REPLACE VIEW v_theme_stats AS
SELECT 
    user_id,
    theme_name,
    display_name,
    summary_count,
    keywords,
    last_updated_at
FROM memory_l2_themes
ORDER BY user_id, summary_count DESC;

-- ============================================
-- 7. 创建清理函数
-- ============================================

-- 清理过期记忆函数
CREATE OR REPLACE FUNCTION cleanup_expired_memories(
    p_user_id INTEGER DEFAULT NULL
) RETURNS TABLE (
    archived_l1 BIGINT,
    deleted_l3 BIGINT
) AS $$
DECLARE
    v_archived_l1 BIGINT;
BEGIN
    -- 归档过期的 L1 记忆（非置顶）
    UPDATE memory_l1_summaries
    SET status = 'archived'
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND status = 'active'
      AND expires_at < NOW()
      AND is_pinned = false;
    
    GET DIAGNOSTICS v_archived_l1 = ROW_COUNT;
    
    -- 返回统计
    archived_l1 := v_archived_l1;
    deleted_l3 := 0;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. 初始化数据 (可选)
-- ============================================

-- 插入一些示例主题 (系统级)
-- INSERT INTO memory_l2_themes (user_id, theme_name, display_name, keywords, first_seen_at)
-- VALUES 
--     (0, 'system_help', '系统帮助', ARRAY['帮助', '使用说明', '功能'], NOW()),
--     (0, 'system_intro', '系统介绍', ARRAY['介绍', '功能', '能力'], NOW());

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Memory V2 tables created successfully' as status;

-- 验证表结构
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('memory_l1_summaries', 'memory_l2_themes', 'memory_access_log')
ORDER BY table_name, ordinal_position;
