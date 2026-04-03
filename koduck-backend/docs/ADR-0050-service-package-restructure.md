# ADR-0050: Service 层包结构重构 - 回归传统分层

- Status: Accepted
- Date: 2026-04-03
- Issue: N/A

## Context

项目在 `ADR-0022` 和 `ADR-0023` 中实施了 DDD 分层改造，将 Service 实现类从 `com.koduck.service.impl` 迁移到各领域的 `application` 包下：

- `identity.application.*`
- `market.application.*`
- `strategy.application.*`
- `trading.application.*`
- `community.application.*`
- `shared.application.*`

但经过实践发现，这种命名方式存在以下问题：

1. **语义模糊**：`application` 容易与 Spring Boot 的 "Application" 概念混淆，而非表达 "应用层"
2. **架构不一致**：Controller、Entity、Repository 等仍放在根目录，只有 Service 按领域分包，导致结构混杂
3. **可读性差**：如 `shared.application.RateLimiterServiceImpl` 读起来像"共享的应用程序的服务"
4. **偏离团队习惯**：团队更熟悉传统 Spring Boot 分层结构（service/impl）

## Decision

将 Service 实现类从各领域的 `*.application` 包迁移回传统分层结构 `com.koduck.service.impl`。

### 具体变更

| 原包路径 | 新包路径 |
|---------|---------|
| `com.koduck.identity.application.*` | `com.koduck.service.impl.*` |
| `com.koduck.market.application.*` | `com.koduck.service.impl.*` |
| `com.koduck.strategy.application.*` | `com.koduck.service.impl.*` |
| `com.koduck.trading.application.*` | `com.koduck.service.impl.*` |
| `com.koduck.community.application.*` | `com.koduck.service.impl.*` |
| `com.koduck.shared.application.*` | `com.koduck.service.impl.*` |

### 保留的接口位置

Service 接口继续保留在 `com.koduck.service` 包下，维持：
- 接口与实现的分离
- Controller 层通过接口依赖的编程模式

## Consequences

### 正向影响

| 方面 | 说明 |
|-----|------|
| 语义清晰 | `service.impl` 直观表达"服务实现"，无歧义 |
| 符合惯例 | 与 Spring Boot 社区主流实践一致 |
| 降低认知成本 | 新成员无需理解 DDD 分层术语即可快速定位代码 |
| 简化目录结构 | 28 个实现类统一收纳，减少包层级深度 |

### 消极影响 / 代价

| 方面 | 说明 |
|-----|------|
| 领域边界弱化 | 无法通过包结构直观识别服务所属业务领域 |
| 与前期 ADR 冲突 | 此决策与 `ADR-0022`、`ADR-0023` 的方向相反 |
| 短期内需适应 | 开发者需从 DDD 思维切换回传统分层思维 |

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 无 | Controller 层通过接口调用，实现类包变更不影响 API |
| 数据库 | 无 | 不涉及表结构或数据迁移 |
| 测试 | 已修复 | 测试文件的 import 已同步更新 |
| 外部依赖 | 无 | Service 实现类为内部使用，不对外暴露 |

## Alternatives Considered

1. **保留 DDD 分层，改为更明确的包名如 `service` / `domain` / `infrastructure`**
   - 未采用：完整 DDD 分层需要同步重构 Controller、Repository 等层，改动范围过大

2. **按领域在 `service` 下建立子包（如 `service/identity/`、`service/market/`）**
   - 未采用：当前实现类数量适中（28个），直接放 `impl` 下更简洁；未来若膨胀可考虑二次拆分

3. **维持现状（`*.application` 包）**
   - 拒绝：命名不清晰，与团队习惯不符，长期维护成本高

## Related

- `ADR-0022`: DDD Phase 1 代码实现
- `ADR-0023`: DDD Phase 2 完成剩余 ServiceImpl 迁移
- `ADR-0048`: Service 层冗余消除

## Verification

- [x] `mvn clean compile -f koduck-backend/pom.xml` 通过
- [x] `mvn checkstyle:check -f koduck-backend/pom.xml` 无异常
- [x] `./scripts/quality-check.sh` 全绿
- [x] 所有 `*.application` 包已删除
- [x] 测试文件 import 已更新
