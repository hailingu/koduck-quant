# 密钥与敏感信息管理（Spring Vault）

## 背景

当前项目通过环境变量注入敏感信息（如 `JWT_SECRET`、`DB_PASSWORD`、`SMTP_PASSWORD`），适合早期开发，但在多环境与多人协作场景下存在以下问题：

- 密钥轮换和审计流程分散；
- 环境变量命名与来源不统一；
- 敏感配置缺少集中治理入口。

为此，项目引入 Spring Vault 作为统一密钥管理基线。

## 设计目标

- 保持向后兼容：默认仍可使用环境变量；
- 显式启用：默认关闭 Vault，避免影响本地开发；
- 渐进迁移：允许按模块逐步迁移到 Vault。

## 配置基线

已在 `application.yml` 增加以下配置骨架：

- `spring.config.import=optional:vault://`
- `spring.cloud.vault.enabled=${VAULT_ENABLED:false}`
- `spring.cloud.vault.kv.default-context=${VAULT_KV_CONTEXT:koduck-backend}`

默认情况下（`VAULT_ENABLED=false`）不会从 Vault 拉取配置。

## 推荐环境变量

- `VAULT_ENABLED`：是否启用 Vault，默认 `false`
- `VAULT_HOST`：Vault 地址，默认 `localhost`
- `VAULT_PORT`：Vault 端口，默认 `8200`
- `VAULT_SCHEME`：协议，默认 `http`
- `VAULT_TOKEN`：访问令牌
- `VAULT_KV_BACKEND`：KV 后端路径，默认 `secret`
- `VAULT_KV_CONTEXT`：默认上下文，默认 `koduck-backend`

## 建议迁移路径

1. 先在 Vault 建立与当前环境变量等价的键值。
2. 在测试或预发环境开启 `VAULT_ENABLED=true` 验证读取行为。
3. 关键密钥优先迁移（JWT、数据库、邮件凭据）。
4. 迁移稳定后，逐步减少环境变量中的敏感明文。

## 示例（开发环境）

```bash
export VAULT_ENABLED=true
export VAULT_HOST=127.0.0.1
export VAULT_PORT=8200
export VAULT_SCHEME=http
export VAULT_TOKEN=xxxx
export VAULT_KV_BACKEND=secret
export VAULT_KV_CONTEXT=koduck-backend
```

## 运维注意事项

- 生产建议使用 TLS（`VAULT_SCHEME=https`）；
- 建议通过短期令牌或 AppRole 等方式替代长期静态令牌；
- 启用审计日志并按最小权限分配访问策略。
