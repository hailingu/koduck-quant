# ADR-0022: DDD Phase 1 代码落地（核心服务按领域迁移）

- Status: Accepted
- Date: 2026-04-02
- Issue: #332

## Context

`ADR-0021` 已定义 bounded context 与模块边界，但在代码层仍存在大量核心服务集中于 `com.koduck.service.impl`，边界未显式体现。

## Decision

执行 DDD Phase 1 迁移：将核心服务实现按业务领域迁移到 `application` 包，保持接口契约不变。

迁移映射：

- `identity.application`：`AuthServiceImpl`
- `market.application`：`MarketServiceImpl`、`KlineServiceImpl`、`TechnicalIndicatorServiceImpl`、`WatchlistServiceImpl`
- `strategy.application`：`StrategyServiceImpl`
- `trading.application`：`BacktestServiceImpl`、`PortfolioServiceImpl`
- `community.application`：`CommunitySignalServiceImpl`

测试中对实现类的直接引用同步更新到新包路径。

## Consequences

正向影响：

- 领域边界从“文档约定”变为“代码结构可见”；
- 控制器/调用方仍通过接口注入，迁移风险可控；
- 后续增量迁移可按同一模式推进。

代价：

- 仍存在部分服务未完成迁移，短期内新旧结构并存；
- 需要后续持续治理跨域依赖与 package 收敛。

## Alternatives Considered

1. 一次性迁移全部服务实现
   - 未采用：范围过大，风险高。

2. 仅保留文档，不做包结构迁移
   - 拒绝：无法形成可执行架构约束。

## Verification

- 主代码 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过；
- 受影响测试导入已更新至新包路径。
