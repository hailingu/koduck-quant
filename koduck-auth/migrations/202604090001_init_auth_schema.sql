-- ============================================================
-- 001_initial.sql
-- 模块: koduck-auth
-- 目标数据库: PostgreSQL 14+
-- 约束策略: 仅主键/唯一键，不使用外键（NO FOREIGN KEY）
-- ============================================================

-- ------------------------------------------------------------
-- 1. 用户与权限域模型
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL       PRIMARY KEY,
    username        VARCHAR(50)     NOT NULL,
    email           VARCHAR(100)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    nickname        VARCHAR(50),
    avatar_url      VARCHAR(255),
    status          VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    email_verified  BOOLEAN         NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_email    UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS roles (
    id              BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL,
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_roles_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id         BIGINT          NOT NULL,
    role_id         BIGINT          NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS permissions (
    id              BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL,
    resource        VARCHAR(50)     NOT NULL,
    action          VARCHAR(50)     NOT NULL,
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_permissions_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         BIGINT          NOT NULL,
    permission_id   BIGINT          NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------
-- 2. 认证安全域模型
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    token_hash      VARCHAR(255)    NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    token_hash      VARCHAR(255)    NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    used_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id                  BIGSERIAL       PRIMARY KEY,
    ip_address          VARCHAR(45)     NOT NULL,
    username_attempted  VARCHAR(50),
    attempt_count       INTEGER         NOT NULL DEFAULT 1,
    last_attempt_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    locked_until        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT,
    action          VARCHAR(50)     NOT NULL,
    resource        VARCHAR(50)     NOT NULL,
    resource_id     VARCHAR(100),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    details         JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. 种子数据
-- ------------------------------------------------------------

INSERT INTO roles (name, description)
VALUES
    ('USER', '普通用户'),
    ('ADMIN', '管理员'),
    ('PREMIUM', '付费用户')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, resource, action, description)
VALUES
    ('user:read', 'user', 'read', '读取用户信息'),
    ('user:write', 'user', 'write', '修改用户信息'),
    ('admin:full', 'admin', 'full', '管理员全部权限')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN'
  AND p.name = 'admin:full'
ON CONFLICT DO NOTHING;
