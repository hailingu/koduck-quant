CREATE TABLE IF NOT EXISTS memory_sessions (
    session_id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    parent_session_id UUID NULL,
    forked_from_session_id UUID NULL,
    title VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    last_message_at TIMESTAMPTZ NOT NULL,
    extra_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_memory_sessions_tenant_user_created_at
    ON memory_sessions (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_sessions_tenant_last_message_at
    ON memory_sessions (tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_sessions_parent_session_id
    ON memory_sessions (parent_session_id);
CREATE INDEX IF NOT EXISTS idx_memory_sessions_forked_from_session_id
    ON memory_sessions (forked_from_session_id);

CREATE TABLE IF NOT EXISTS memory_entries (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    sequence_num BIGINT NOT NULL,
    role VARCHAR(32) NOT NULL,
    raw_content_ref VARCHAR(512) NOT NULL,
    message_ts TIMESTAMPTZ NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    l0_uri VARCHAR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_memory_entries_tenant_session_sequence
        UNIQUE (tenant_id, session_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_memory_entries_tenant_session_message_ts
    ON memory_entries (tenant_id, session_id, message_ts DESC);
CREATE INDEX IF NOT EXISTS idx_memory_entries_tenant_session_created_at
    ON memory_entries (tenant_id, session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_index_records (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    entry_id UUID NULL,
    memory_kind VARCHAR(64) NOT NULL,
    domain_class VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    snippet TEXT NULL,
    source_uri VARCHAR(1024) NOT NULL,
    score_hint NUMERIC(10, 4) NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_index_records_tenant_domain_updated
    ON memory_index_records (tenant_id, domain_class, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_index_records_tenant_session_domain
    ON memory_index_records (tenant_id, session_id, domain_class, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_index_records_memory_kind
    ON memory_index_records (memory_kind);
CREATE INDEX IF NOT EXISTS idx_memory_index_records_summary_gin
    ON memory_index_records
    USING GIN (to_tsvector('simple', COALESCE(summary, '')));
CREATE INDEX IF NOT EXISTS idx_memory_index_records_snippet_gin
    ON memory_index_records
    USING GIN (to_tsvector('simple', COALESCE(snippet, '')));

CREATE TABLE IF NOT EXISTS memory_summaries (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    domain_class VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    strategy VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_memory_summaries_tenant_session_version
        UNIQUE (tenant_id, session_id, version)
);

CREATE INDEX IF NOT EXISTS idx_memory_summaries_tenant_session_created_at
    ON memory_summaries (tenant_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_tenant_domain_class
    ON memory_summaries (tenant_id, domain_class);

CREATE TABLE IF NOT EXISTS memory_facts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    fact_type VARCHAR(64) NOT NULL,
    domain_class VARCHAR(64) NOT NULL,
    fact_text TEXT NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_tenant_session_created_at
    ON memory_facts (tenant_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_facts_tenant_domain_class
    ON memory_facts (tenant_id, domain_class);

CREATE TABLE IF NOT EXISTS memory_idempotency_keys (
    idempotency_key VARCHAR(128) PRIMARY KEY,
    tenant_id VARCHAR(128) NULL,
    session_id UUID NULL,
    operation VARCHAR(64) NOT NULL,
    request_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_idempotency_keys_tenant_session_operation
    ON memory_idempotency_keys (tenant_id, session_id, operation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_idempotency_keys_expires_at
    ON memory_idempotency_keys (expires_at);
