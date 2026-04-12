CREATE TABLE IF NOT EXISTS memory_task_attempts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    task_type VARCHAR(64) NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    error_message TEXT NULL,
    request_id VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_task_attempts_tenant_session_type
    ON memory_task_attempts (tenant_id, session_id, task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_task_attempts_status
    ON memory_task_attempts (status);
CREATE INDEX IF NOT EXISTS idx_memory_task_attempts_created_at
    ON memory_task_attempts (created_at DESC);
