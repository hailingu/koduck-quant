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
    memory_unit_id UUID NULL,
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
CREATE INDEX IF NOT EXISTS idx_memory_index_records_memory_unit_id
    ON memory_index_records (memory_unit_id);
