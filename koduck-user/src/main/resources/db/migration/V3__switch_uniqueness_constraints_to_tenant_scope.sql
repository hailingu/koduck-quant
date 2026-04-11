-- ============================================================
-- V3__switch_uniqueness_constraints_to_tenant_scope.sql
-- 模块: koduck-user
-- 目标数据库: PostgreSQL 14+
-- 目标: 将用户与角色唯一约束切换为租户内唯一
-- ============================================================

-- ------------------------------------------------------------
-- 1. 默认 tenant 收口
-- ------------------------------------------------------------

UPDATE users
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

UPDATE roles
SET tenant_id = 'default'
WHERE tenant_id IS NULL;

-- ------------------------------------------------------------
-- 2. 切换用户唯一约束
-- ------------------------------------------------------------

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS uk_users_username,
    DROP CONSTRAINT IF EXISTS uk_users_email;

ALTER TABLE users
    ADD CONSTRAINT uk_users_tenant_username UNIQUE (tenant_id, username),
    ADD CONSTRAINT uk_users_tenant_email UNIQUE (tenant_id, email);

-- ------------------------------------------------------------
-- 3. 切换角色唯一约束
-- ------------------------------------------------------------

ALTER TABLE roles
    DROP CONSTRAINT IF EXISTS uk_roles_name;

ALTER TABLE roles
    ADD CONSTRAINT uk_roles_tenant_name UNIQUE (tenant_id, name);
