-- 3-level memory storage (PageIndex-style, non-vector)
-- L1: raw compressed pages
-- L2: theme abstraction derived from L1
-- L3: keyword inverted index derived from L2/L1

CREATE TABLE IF NOT EXISTS memory_l1_pages (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(128),
    role_pack VARCHAR(64),
    ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content_compressed BYTEA NOT NULL,
    codec VARCHAR(16) NOT NULL DEFAULT 'zlib',
    md5 CHAR(32) NOT NULL,
    size_raw INTEGER,
    size_compressed INTEGER,
    meta JSONB,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_l1_user_ts
    ON memory_l1_pages(user_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_memory_l1_md5
    ON memory_l1_pages(md5);

CREATE INDEX IF NOT EXISTS idx_memory_l1_expires_at
    ON memory_l1_pages(expires_at);

CREATE TABLE IF NOT EXISTS memory_l2_themes (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    theme_name VARCHAR(128) NOT NULL,
    summary TEXT,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    page_ids UUID[] NOT NULL DEFAULT '{}',
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

CREATE TABLE IF NOT EXISTS memory_l3_keywords (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    keyword VARCHAR(128) NOT NULL,
    theme_id UUID,
    page_id UUID,
    weight NUMERIC(8,4) NOT NULL DEFAULT 1,
    ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_l3_user_keyword
    ON memory_l3_keywords(user_id, keyword);

CREATE INDEX IF NOT EXISTS idx_memory_l3_theme_id
    ON memory_l3_keywords(theme_id);

CREATE INDEX IF NOT EXISTS idx_memory_l3_page_id
    ON memory_l3_keywords(page_id);

CREATE INDEX IF NOT EXISTS idx_memory_l3_ts
    ON memory_l3_keywords(ts DESC);

CREATE TABLE IF NOT EXISTS memory_config (
    user_id BIGINT PRIMARY KEY,
    mode VARCHAR(8) NOT NULL DEFAULT 'L0',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    enable_l1 BOOLEAN NOT NULL DEFAULT TRUE,
    enable_l2 BOOLEAN NOT NULL DEFAULT TRUE,
    enable_l3 BOOLEAN NOT NULL DEFAULT TRUE,
    write_per_turn BOOLEAN NOT NULL DEFAULT TRUE,
    async_index BOOLEAN NOT NULL DEFAULT TRUE,
    retrieve_max_pages INTEGER NOT NULL DEFAULT 8,
    retrieve_token_budget INTEGER NOT NULL DEFAULT 1500,
    ttl_days_l1 INTEGER NOT NULL DEFAULT 30,
    ttl_days_l2 INTEGER NOT NULL DEFAULT 90,
    ttl_days_l3 INTEGER NOT NULL DEFAULT 180,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_config_updated_at
    ON memory_config(updated_at DESC);
