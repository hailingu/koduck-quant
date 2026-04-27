CREATE TABLE IF NOT EXISTS memory_plans (
    plan_id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    request_id VARCHAR(128) NOT NULL,
    goal TEXT NOT NULL,
    status VARCHAR(64) NOT NULL,
    created_by VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_plans_tenant_session_updated_at
    ON memory_plans (tenant_id, session_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_plans_tenant_request
    ON memory_plans (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_memory_plans_status
    ON memory_plans (status);

CREATE TABLE IF NOT EXISTS memory_plan_events (
    event_id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id) ON DELETE CASCADE,
    sequence_num BIGINT NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_memory_plan_events_tenant_session_plan_sequence
        UNIQUE (tenant_id, session_id, plan_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_memory_plan_events_tenant_session_plan_created_at
    ON memory_plan_events (tenant_id, session_id, plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_plan_events_event_type
    ON memory_plan_events (event_type);

CREATE TABLE IF NOT EXISTS memory_plan_snapshots (
    snapshot_id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id) ON DELETE CASCADE,
    version BIGINT NOT NULL,
    state_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_memory_plan_snapshots_tenant_session_plan_version
        UNIQUE (tenant_id, session_id, plan_id, version)
);

CREATE INDEX IF NOT EXISTS idx_memory_plan_snapshots_tenant_session_plan_created_at
    ON memory_plan_snapshots (tenant_id, session_id, plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_plan_artifacts (
    artifact_id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id) ON DELETE CASCADE,
    node_id VARCHAR(256) NULL,
    artifact_type VARCHAR(128) NOT NULL,
    content_json JSONB NULL,
    object_uri VARCHAR(1024) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_plan_artifacts_tenant_session_plan_created_at
    ON memory_plan_artifacts (tenant_id, session_id, plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_plan_artifacts_plan_node
    ON memory_plan_artifacts (plan_id, node_id);

CREATE TABLE IF NOT EXISTS memory_edit_proposals (
    proposal_id UUID PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    session_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id) ON DELETE CASCADE,
    node_id VARCHAR(256) NULL,
    target_kind VARCHAR(64) NOT NULL,
    operation VARCHAR(64) NOT NULL,
    target_ref VARCHAR(512) NULL,
    before_json JSONB NULL,
    after_json JSONB NOT NULL,
    reason TEXT NULL,
    confidence NUMERIC(5, 4) NULL,
    status VARCHAR(64) NOT NULL,
    created_by VARCHAR(128) NULL,
    reviewed_by VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ NULL,
    applied_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_edit_proposals_tenant_session_plan_created_at
    ON memory_edit_proposals (tenant_id, session_id, plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_edit_proposals_status
    ON memory_edit_proposals (status);
CREATE INDEX IF NOT EXISTS idx_memory_edit_proposals_target
    ON memory_edit_proposals (target_kind, target_ref);
