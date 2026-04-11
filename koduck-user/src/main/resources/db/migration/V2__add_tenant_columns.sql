-- ============================================================
-- V2__add_tenant_columns.sql
-- 模块: koduck-user
-- 目标数据库: PostgreSQL 14+
-- 目标: 引入最小租户真值与 tenant_id 基础列
-- ============================================================

-- ------------------------------------------------------------
-- 1. 最小租户真值
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenants (
    id          VARCHAR(128)    PRIMARY KEY,
    name        VARCHAR(128)    NOT NULL,
    status      VARCHAR(32)     NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tenants (id, name, status)
VALUES ('default', 'Default Tenant', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- 2. 主表 tenant_id
-- ------------------------------------------------------------

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

-- ------------------------------------------------------------
-- 3. 关系表 / 凭证表 tenant 语义
-- ------------------------------------------------------------

ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

ALTER TABLE role_permissions
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

ALTER TABLE user_credentials
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);

-- ------------------------------------------------------------
-- 4. 默认 tenant 回填与约束
-- ------------------------------------------------------------

UPDATE users
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE roles
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE user_roles
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE role_permissions
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE user_credentials
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

ALTER TABLE users
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE roles
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE user_roles
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE role_permissions
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE user_credentials
    ALTER COLUMN tenant_id SET DEFAULT 'default',
    ALTER COLUMN tenant_id SET NOT NULL;

-- ------------------------------------------------------------
-- 5. 基础索引（唯一约束切换在 Task 2.3）
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_user_id ON user_roles (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role_id ON role_permissions (tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_tenant_user_id ON user_credentials (tenant_id, user_id);
