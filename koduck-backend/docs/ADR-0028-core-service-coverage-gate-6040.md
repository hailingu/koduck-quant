# ADR-0028: 核心服务覆盖率门禁提升至 60/40

- Status: Accepted
- Date: 2026-04-02
- Issue: #344

## Context

当前覆盖率基线约为 40.6%，无法满足核心业务重构的安全需求。现有 JaCoCo 门禁仍聚焦旧范围，无法准确反映当前核心业务服务的测试质量。

同时，团队希望以命令 `mvn test jacoco:check` 作为统一本地与 CI 验证入口，因此门禁配置需要兼容该命令的直接执行语义。

## Decision

1. 将覆盖率门禁目标统一为：
   - 行覆盖率（LINE）`>= 0.60`
   - 分支覆盖率（BRANCH）`>= 0.40`
2. 门禁聚焦到核心业务服务实现类：
   - `MarketServiceImpl`
   - `PortfolioServiceImpl`
   - `AiAnalysisServiceImpl`
3. 将 JaCoCo check 配置上提到插件级 `<configuration>`，确保 `mvn test jacoco:check` 直接执行时也能复用同一套规则。
4. 默认 `mvn test` 排除集成/烟雾测试与 `SecurityConfigTest`，避免环境依赖型测试阻塞核心覆盖率门禁；相关测试通过分层测试流程单独执行。

## Consequences

正向影响：

- 覆盖率门禁与核心业务风险面一致，提升重构安全性；
- 本地与 CI 命令入口一致，降低“本地过、CI 挂”概率；
- 覆盖治理路径清晰，可持续进行增量提升。

代价：

- 非核心模块的覆盖率不在该门禁直接约束范围内，需要后续分阶段扩圈；
- 分层测试策略对测试分类和执行约定提出更高要求。

## Alternatives Considered

1. 立即对全仓所有业务类启用 60/40
   - 暂不采用：当前存量测试与环境依赖较多，一次性收紧会显著降低交付效率。

2. 继续沿用旧 8 类门禁范围
   - 拒绝：与当前“聚焦核心服务”目标不一致，且无法覆盖 Portfolio/AI 分析核心路径。

## Verification

- `mvn -f koduck-backend/pom.xml test jacoco:check` 通过；
- JaCoCo check 明确命中三类核心服务；
- 文档索引已同步该 ADR。
