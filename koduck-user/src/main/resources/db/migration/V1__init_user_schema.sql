-- ============================================================
-- V1__init_user_schema.sql
-- koduck-user 独立服务数据库初始化
-- 目标数据库: PostgreSQL 14+
-- ============================================================

-- -----------------------------------------------------------
-- 1. 用户表
-- -----------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    username        VARCHAR(50)     NOT NULL,
    email           VARCHAR(100)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    nickname        VARCHAR(50),
    avatar_url      VARCHAR(255),
    status          SMALLINT        NOT NULL DEFAULT 1,  -- 0: DISABLED, 1: ACTIVE, 2: PENDING
    email_verified_at TIMESTAMP,
    last_login_at   TIMESTAMP,
    last_login_ip   VARCHAR(45),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_users_username   UNIQUE (username),
    CONSTRAINT uk_users_email      UNIQUE (email)
);

-- -----------------------------------------------------------
-- 2. 角色表
-- -----------------------------------------------------------
CREATE TABLE roles (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL,
    description     VARCHAR(255),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_roles_name       UNIQUE (name)
);

-- -----------------------------------------------------------
-- 3. 权限表
-- -----------------------------------------------------------
CREATE TABLE permissions (
    id              SERIAL          PRIMARY KEY,
    code            VARCHAR(100)    NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    resource        VARCHAR(50),
    action          VARCHAR(50),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_permissions_code UNIQUE (code)
);

-- -----------------------------------------------------------
-- 4. 用户角色关联表
-- -----------------------------------------------------------
CREATE TABLE user_roles (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    role_id         INTEGER         NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_roles_user       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role       FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT uk_user_roles_user_role  UNIQUE (user_id, role_id)
);

-- -----------------------------------------------------------
-- 5. 角色权限关联表
-- -----------------------------------------------------------
CREATE TABLE role_permissions (
    id              BIGSERIAL       PRIMARY KEY,
    role_id         INTEGER         NOT NULL,
    permission_id   INTEGER         NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_role_permissions_role         FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission   FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT uk_role_permissions_role_perm    UNIQUE (role_id, permission_id)
);

-- -----------------------------------------------------------
-- 6. 用户凭证表（支持多因素认证）
-- -----------------------------------------------------------
CREATE TABLE user_credentials (
    id                  BIGSERIAL       PRIMARY KEY,
    user_id             BIGINT          NOT NULL,
    credential_type     VARCHAR(20)     NOT NULL,  -- PASSWORD, TOTP, FIDO2, etc.
    credential_value    VARCHAR(255)    NOT NULL,
    environment         VARCHAR(20)     NOT NULL DEFAULT 'PRODUCTION',
    verification_status VARCHAR(20)     NOT NULL DEFAULT 'UNVERIFIED',
    verified_at         TIMESTAMP,
    expires_at          TIMESTAMP,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_credentials_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 索引
-- ============================================================

-- 用户表索引
CREATE INDEX idx_users_username    ON users (username);
CREATE INDEX idx_users_email       ON users (email);
CREATE INDEX idx_users_status      ON users (status);

-- 关联表索引
CREATE INDEX idx_user_roles_user_id        ON user_roles (user_id);
CREATE INDEX idx_user_roles_role_id        ON user_roles (role_id);
CREATE INDEX idx_role_permissions_role_id          ON role_permissions (role_id);
CREATE INDEX idx_role_permissions_permission_id    ON role_permissions (permission_id);

-- 凭证表索引
CREATE INDEX idx_user_credentials_user_id ON user_credentials (user_id);

-- ============================================================
-- updated_at 自动更新触发器
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_user_credentials_updated_at
    BEFORE UPDATE ON user_credentials
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- 种子数据
-- ============================================================

-- 基础角色
INSERT INTO roles (name, description) VALUES
    ('ROLE_USER',        '普通用户'),
    ('ROLE_ADMIN',       '管理员'),
    ('ROLE_SUPER_ADMIN', '超级管理员');

-- 基础权限
INSERT INTO permissions (code, name, resource, action) VALUES
    ('user:read',   '查看用户', 'user', 'read'),
    ('user:write',  '编辑用户', 'user', 'write'),
    ('user:delete', '删除用户', 'user', 'delete'),
    ('role:read',   '查看角色', 'role', 'read'),
    ('role:write',  '编辑角色', 'role', 'write'),
    ('role:delete', '删除角色', 'role', 'delete');

-- 为超级管理员分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ROLE_SUPER_ADMIN';
