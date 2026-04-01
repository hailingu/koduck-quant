# ADR-0010: Demo 用户默认禁用（显式开启）

- Status: Accepted
- Date: 2026-04-01
- Issue: #310

## Context

`app.demo.enabled` 当前默认值为 `true`，意味着在未明确配置的环境中可能意外启用 Demo 用户，带来账号暴露与环境误配置风险。

团队希望将 Demo 功能改为“显式开启”模式：默认关闭，仅在需要时通过环境变量打开。

## Decision

采用“生产安全默认 + 开发便捷覆盖”的配置策略：

- 在 `application.yml` 中将 `app.demo.enabled` 默认值改为 `false`：
  - `enabled: ${APP_DEMO_ENABLED:false}`
- 在 `application-dev.yml` 中增加开发环境覆盖，默认保持可用：
  - `enabled: ${APP_DEMO_ENABLED:true}`

这样可确保：

- 非开发环境在未设置环境变量时默认禁用 Demo；
- 开发环境可继续按需使用 Demo，且仍可由环境变量统一控制。

## Consequences

正向影响：

- 提升默认安全基线，降低误开启风险；
- 配置意图更明确，便于环境治理；
- 保留开发效率，不影响本地联调体验。

代价：

- 若测试环境依赖 Demo 且未设置环境变量，需显式启用。

## Alternatives Considered

1. 全环境默认 `true`，仅靠生产部署规范约束  
   - 拒绝：人依赖强，容易漏配。

2. 全环境默认 `false`，不做开发覆盖  
   - 暂不采用：会增加开发联调成本。

## Verification

- `application.yml` 默认值已改为 `false`；
- `application-dev.yml` 已增加开发默认开启覆盖；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
