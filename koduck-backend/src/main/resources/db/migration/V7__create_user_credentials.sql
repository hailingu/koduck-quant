-- 用户凭证表 - 用于安全存储 API Key 和 Secret
CREATE TABLE IF NOT EXISTS user_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BROKER', 'DATA_SOURCE', 'EXCHANGE', 'AI_PROVIDER')),
    provider VARCHAR(50) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT,
    environment VARCHAR(20) CHECK (environment IN ('paper', 'live', 'sandbox')),
    additional_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_verified_at TIMESTAMP,
    last_verified_status VARCHAR(20) CHECK (last_verified_status IN ('SUCCESS', 'FAILED', 'PENDING')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX idx_user_credentials_type ON user_credentials(type);
CREATE INDEX idx_user_credentials_provider ON user_credentials(provider);

-- 凭证操作审计日志表
CREATE TABLE IF NOT EXISTS credential_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    credential_id BIGINT,
    user_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VERIFY', 'VIEW')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (credential_id) REFERENCES user_credentials(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_credential_audit_logs_user_id ON credential_audit_logs(user_id);
CREATE INDEX idx_credential_audit_logs_credential_id ON credential_audit_logs(credential_id);
CREATE INDEX idx_credential_audit_logs_created_at ON credential_audit_logs(created_at);

-- 添加注释
COMMENT ON TABLE user_credentials IS '用户凭证表 - 存储加密的 API Key 和 Secret';
COMMENT ON COLUMN user_credentials.api_key_encrypted IS 'AES-256 加密的 API Key';
COMMENT ON COLUMN user_credentials.api_secret_encrypted IS 'AES-256 加密的 API Secret';
COMMENT ON COLUMN user_credentials.additional_config IS '额外配置参数（JSON 格式）';
COMMENT ON TABLE credential_audit_logs IS '凭证操作审计日志';
