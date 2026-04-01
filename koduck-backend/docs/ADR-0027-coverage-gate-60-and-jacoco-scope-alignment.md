# ADR-0027: 测试覆盖率门禁提升到 60% 并对齐 DDD 包路径

- Status: Accepted
- Date: 2026-04-02
- Issue: #342

## Context

当前后端测试覆盖率约为 40.6%，低于团队对重构安全性的最低要求。与此同时，DDD 重构后部分核心类从 `service/impl` 迁移到 `shared/application` 与 `market/application`，但 JaCoCo 门禁 include 仍引用旧路径，导致覆盖率门禁与真实代码结构不一致。

## Decision

1. 维持并执行核心类覆盖率门禁：`LINE >= 0.60`、`BRANCH >= 0.40`。
2. 将 JaCoCo include 路径更新为 DDD 迁移后的真实包路径：
   - `**/shared/application/MemoryServiceImpl.class`
   - `**/shared/application/RateLimiterServiceImpl.class`
   - `**/market/application/MarketServiceImpl.class`
3. 保持其余核心类覆盖范围不变，确保门禁范围稳定可比。
4. 修复与实体不可变性改造后的测试编译断点，保证覆盖率校验可在 CI 中持续执行。

## Consequences

正向影响：

- 覆盖率门禁与当前代码结构一致，避免“门禁形同虚设”；
- 在保持核心路径覆盖约束的同时，降低后续重构回归风险；
- 将测试编译稳定性与覆盖率治理绑定，减少虚假失败。

代价：

- 短期内需要维护门禁白名单与包迁移同步；
- 部分历史测试代码需要持续适配实体约束变更。

## Alternatives Considered

1. 提升为全量包 60% 门禁
   - 暂未采用：当前存量债务较高，直接全量门禁会显著放大一次性改造成本。

2. 暂不调整 include，仅修测试
   - 拒绝：无法保证门禁真正覆盖迁移后的核心实现类。

## Verification

- `mvn -f koduck-backend/pom.xml test jacoco:check` 在本次改造后可执行；
- JaCoCo check 使用的新 include 路径可命中对应核心类；
- ADR 与 `docs/README.md` 索引同步更新。
