# ADR-0073: Service 实现层按领域拆分子包

- Status: Accepted
- Date: 2026-04-04
- Issue: #440

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的可维护性评估，`koduck-backend/src/main/java/com/koduck/service/impl/` 下平铺了 28 个 ServiceImpl 类，缺乏领域子包划分。而项目其他三层已经完成了 DDD 包结构治理：

| 层级 | 结构 |
|------|------|
| `controller/` | 已按 `ai/`, `auth/`, `backtest/`, `market/`, `portfolio/`, `strategy/`, `user/`, `watchlist/` 等拆分 |
| `repository/` | 已按相同领域拆分 |
| `entity/` | 已按相同领域拆分 |
| `service/impl/` | **完全扁平化**，28 个类全部位于根目录 |

这导致：
- **导航困难**：开发者难以在 IDE 中快速定位目标 Service
- **架构不一致**：Service 层成为唯一未对齐的分层，破坏了 DDD 包结构的完整性
- **可维护性下降**：新增 Service 时缺乏明确的放置规范，容易继续堆积在根目录

## Decision

### 1. 按领域拆分 service/impl/

参照 Controller、Repository、Entity 的现有领域划分，将 28 个 ServiceImpl 迁移到对应子包：

| 子包 | 包含的 ServiceImpl |
|------|-------------------|
| `service/impl/ai/` | `AiAnalysisServiceImpl`, `MemoryServiceImpl` |
| `service/impl/auth/` | `AuthServiceImpl` |
| `service/impl/backtest/` | `BacktestServiceImpl` |
| `service/impl/community/` | `CommunitySignalServiceImpl` |
| `service/impl/credential/` | `CredentialServiceImpl` |
| `service/impl/market/` | `KlineServiceImpl`, `KlineSyncServiceImpl`, `MarketBreadthServiceImpl`, `MarketFlowServiceImpl`, `MarketSectorNetFlowServiceImpl`, `MarketSentimentServiceImpl`, `MarketServiceImpl`, `PricePushServiceImpl`, `StockCacheServiceImpl`, `StockSubscriptionServiceImpl`, `SyntheticTickServiceImpl`, `TechnicalIndicatorServiceImpl`, `TickStreamServiceImpl` |
| `service/impl/portfolio/` | `PortfolioServiceImpl` |
| `service/impl/strategy/` | `StrategyServiceImpl` |
| `service/impl/user/` | `EmailServiceImpl`, `MonitoringServiceImpl`, `RateLimiterServiceImpl`, `UserCacheServiceImpl`, `UserServiceImpl`, `UserSettingsServiceImpl` |
| `service/impl/watchlist/` | `WatchlistServiceImpl` |

### 2. Service 接口位置不变

`service/` 根目录下的接口（如 `MarketService.java`、`AuthService.java`）保持原位不变，仅移动实现类。这是 Spring 依赖注入的标准做法，Controller 等调用方通过接口引用，不受包结构变更影响。

### 3. 更新 package 声明与 import

- 所有被移动的 ServiceImpl 更新 `package` 声明
- 测试类中直接引用 `service.impl.*` 的 import 同步更新到新的子包路径
- 不修改任何业务逻辑、方法签名或 API 行为

## Consequences

### 正向影响

- **架构一致性**：Service 层与其他三层（Controller、Repository、Entity）的包结构完全对齐
- **导航效率提升**：IDE 包视图可按领域折叠，新开发者能快速定位目标 Service
- **扩展性改善**：新增 Service 时有明确的放置规范，避免根目录持续膨胀
- **零运行时影响**：纯包结构重构，Spring 依赖注入行为不变

### 兼容性影响

- **文件路径变更**：28 个 ServiceImpl 的物理路径从 `service/impl/` 根目录迁移到子包
- **Git 历史保留**：通过 `git mv` 移动，Git 可追踪文件重命名历史
- **外部引用有限**：主代码通过接口注入，仅测试类和极少数直接引用实现类的代码需要更新 import
- **无 API 变更**：HTTP 接口、DTO、数据库表结构均无变化

## Alternatives Considered

1. **保持现状**
   - 拒绝：28 个类平铺在同一包中已被明确识别为可维护性问题，且其他三层已经完成拆分，Service 层不应成为例外
   - 当前方案：按领域拆分子包

2. **将所有 Service 接口也一起下沉到子包（如 `service/market/MarketService.java` + `service/market/impl/MarketServiceImpl.java`）**
   - 拒绝：改动面过大，需要更新所有 Controller 的 import 和 Spring 注入点；且项目当前接口与实现的分离模式（接口在根目录、实现在 `impl/`）是业界常见做法
   - 当前方案：仅移动实现类，接口保持原位

3. **引入独立的 application/service 模块**
   - 拒绝：属于更高层级的模块化重构，需要改动 Maven 模块结构和依赖关系，超出了本次轻量包结构治理的范围
   - 当前方案：在同一模块内拆分子包

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有现有单元测试与切片测试通过
