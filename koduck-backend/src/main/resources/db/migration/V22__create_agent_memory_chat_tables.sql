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
