-- ============================================================
-- 202604110001_add_tenant_to_security_tables.sql
-- 模块: koduck-auth
-- 目标数据库: PostgreSQL 14+
-- 目标: 为安全域表增加 tenant_id 与租户索引
-- ============================================================

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

UPDATE refresh_tokens
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE password_reset_tokens
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE audit_logs
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

ALTER TABLE refresh_tokens
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE password_reset_tokens
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE audit_logs
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tenant_id ON refresh_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tenant_user_id ON refresh_tokens(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tenant_expires_at ON refresh_tokens(tenant_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tenant_id ON password_reset_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tenant_user_id ON password_reset_tokens(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tenant_expires_at ON password_reset_tokens(tenant_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user_created ON audit_logs(tenant_id, user_id, created_at);
