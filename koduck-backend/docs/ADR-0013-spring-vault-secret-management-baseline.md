# ADR-0013: 补充 API 密钥与敏感信息统一管理方案（Spring Vault）

- Status: Accepted
- Date: 2026-04-01
- Issue: #316

## Context

当前项目的敏感配置（如 `JWT_SECRET`、`DB_PASSWORD`、`SMTP_PASSWORD`）主要通过环境变量注入。该方式在项目早期成本较低，但随着环境与协作规模扩大，暴露出以下问题：

- 密钥轮换、审计和访问控制缺少统一入口；
- 配置分散在运行环境中，不利于治理与追踪；
- 缺少标准化的密钥管理策略文档。

## Decision

采用 Spring Vault 作为后端服务密钥管理基线，并遵循以下规则：

- 在 `pom.xml` 引入 `spring-cloud-starter-vault-config`；
- 配置层增加 Vault 接入骨架，默认禁用（`VAULT_ENABLED=false`）；
- 使用 `optional:vault://` 方式挂载，确保未启用时不影响本地开发；
- 保留现有环境变量方式，支持渐进迁移；
- 新增独立文档说明迁移与运维建议。

## Consequences

正向影响：

- 建立统一密钥管理方向，降低凭据散落风险；
- 支持后续按最小权限和审计策略治理敏感信息；
- 为生产环境密钥轮换提供标准接入点。

代价：

- 需要运维侧提供 Vault 实例、策略与访问控制；
- 开启 Vault 的环境需要额外配置令牌与网络连通。

## Alternatives Considered

1. 继续仅使用环境变量
   - 拒绝：治理能力不足，难以规模化管理。

2. 使用云厂商托管密钥服务（如 AWS Secrets Manager）
   - 暂不采用：当前团队技术栈与部署形态更适合先建立 Vault 通用方案。

## Verification

- `koduck-backend/pom.xml` 已引入 Spring Vault 依赖与 Spring Cloud BOM；
- `koduck-backend/src/main/resources/application.yml` 已增加 Vault 配置骨架且默认禁用；
- 已新增文档：`koduck-backend/docs/SECRET-MANAGEMENT.md`；
- 本地执行 `mvn -DskipTests compile` 验证构建通过。
