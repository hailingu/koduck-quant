# ADR-0015: 生产环境 JWT 密钥强制由 Vault 管理

- Status: Accepted
- Date: 2026-04-01
- Issue: #320

## Context

虽然项目已引入 Spring Vault 基线，但生产配置未显式强制 Vault，仍存在“Vault 不可用时可能继续以环境变量方式运行”的风险。对于 JWT 签名密钥，此风险等级高。

## Decision

在生产环境 (`application-prod.yml`) 强制启用 Vault：

- `spring.config.import=vault://`（非 optional）；
- `spring.cloud.vault.enabled=true`；
- `spring.cloud.vault.fail-fast=true`；
- JWT 密钥 `JWT_SECRET` 在生产环境必须由 Vault 提供。

## Consequences

正向影响：

- 消除生产环境对 JWT 密钥的“静默降级”路径；
- 提升密钥治理一致性和可审计性；
- 将 Vault 连通性与密钥可用性前置为启动前置条件。

代价：

- 生产环境启动对 Vault 可用性产生强依赖；
- 发布前需提前验证 Vault 路径、策略与令牌配置。

## Alternatives Considered

1. 保持 optional:vault:// 并继续容许环境变量回退
   - 拒绝：高价值密钥存在治理绕过风险。

2. 仅通过流程约束，不做配置层强制
   - 拒绝：执行一致性不可保证，审计成本高。

## Verification

- `application-prod.yml` 已显式配置 `vault://`、`enabled=true`、`fail-fast=true`；
- `SECRET-MANAGEMENT.md` 已新增生产 JWT 强制策略说明；
- 本地 `mvn -DskipTests compile` 验证通过。
