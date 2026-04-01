# ADR-0014: Security permitAll 端点策略外置配置化

- Status: Accepted
- Date: 2026-04-01
- Issue: #318

## Context

`SecurityConfig` 中存在多组 `permitAll` 端点路径硬编码。随着接口演进，该模式会带来：

- 路径变更需要修改 Java 代码并重新发布；
- 安全策略分散在代码实现中，审查与维护成本高；
- 不利于不同环境基于配置快速调整公开端点策略。

## Decision

将 `permitAll` 策略迁移为配置驱动：

- 新增 `SecurityEndpointProperties`（前缀 `koduck.security`）；
- `SecurityConfig` 读取配置项动态装配 `requestMatchers`；
- 提供两组策略：
  - `permit-all-patterns`：全方法公开
  - `permit-all-get-patterns`：仅 GET 公开
- 默认配置保持与迁移前一致，确保行为不回归。

## Consequences

正向影响：

- 公开路径维护从代码改动转为配置改动，降低变更成本；
- 安全策略可读性与可审计性提升；
- 为后续分环境安全策略差异化奠定基础。

代价：

- 配置错误可能导致暴露或误拦截，需要变更评审；
- 策略分散到配置文件后，需要文档和发布流程约束。

## Alternatives Considered

1. 继续使用硬编码常量
   - 拒绝：维护性问题持续存在。

2. 将路径常量集中到单独 Java 常量类
   - 未采用：虽然减少分散，但仍需代码发布，无法实现配置层运维弹性。

## Verification

- `SecurityConfig` 已移除多组硬编码 `permitAll` 路径；
- 新增 `koduck.security` 配置并完成默认值对齐；
- 新增文档：`koduck-backend/docs/SECURITY-ENDPOINTS.md`；
- 本地 `mvn -DskipTests compile` 通过。
