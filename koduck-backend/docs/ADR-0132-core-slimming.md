# ADR-0132: koduck-core 瘦身

## 状态

- **状态**: 已暂停（等待 Phase 2 完成）
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

当前 `koduck-core` 模块包含了大量的业务逻辑代码（约 28,589 行），包括 Service、Repository、Entity 等。随着架构改进计划的推进，各领域模块已经分离出独立的 `*-api` 和 `*-impl` 模块，`koduck-core` 的职责需要重新定位。

## 当前状态分析

### koduck-core 代码分布

| 类别 | 文件数 | 估算行数 | 说明 |
|------|--------|----------|------|
| Service | 52 | ~8,000 | 包含业务逻辑实现 |
| Repository | 20 | ~2,000 | 数据访问层 |
| Entity | 22 | ~3,000 | 实体类 |
| Controller | 10 | ~2,000 | REST API 控制器 |
| DTO | ~80 | ~8,000 | 数据传输对象 |
| 其他 | ~25 | ~5,000 | 配置、工具类等 |
| **总计** | **~209** | **~28,589** | |

### 需要迁移的代码

1. **Market 相关代码** (~3,000 行)
   - `com.koduck.market.provider`: USStockProvider, ForexProvider, HKStockProvider, AKShareDataProvider 等
   - `com.koduck.market.model`: KlineData, TickData 等
   - `com.koduck.market.util`: DataConverter, MarketFieldParser 等
   - `com.koduck.market.MarketType`

2. **Backtest 相关代码** (~1,500 行)
   - `BacktestServiceImpl` (558 行)
   - `BacktestResultDto` 等 DTO
   - `com.koduck.entity.backtest` 实体类
   - `com.koduck.repository.backtest` Repository

3. **User 相关代码** (~2,500 行)
   - `UserServiceImpl`
   - `UserSettingsServiceImpl`
   - `EmailServiceImpl`
   - `UserCacheServiceImpl`
   - `MonitoringServiceImpl`
   - `RateLimiterServiceImpl`

4. **Credential 相关代码** (~1,000 行)
   - `CredentialServiceImpl` (415 行)
   - `com.koduck.entity.credential` 实体类
   - `com.koduck.repository.credential` Repository

5. **Auth 相关代码** (~1,000 行)
   - `AuthServiceImpl` (385 行)

6. **其他代码** (~2,000 行)
   - `KlineService`, `KlineSyncService`
   - `StockCacheService`, `StockSubscriptionService`
   - `StrategyService`, `WatchlistService`
   - `SyntheticTickService`, `TechnicalIndicatorService`
   - Controllers, Mappers, Config 等

### 已迁移的代码

- Portfolio Service（已迁移到 `koduck-portfolio-impl`）
- 部分 Market Service（已迁移到 `koduck-market-impl`）
- Community Service（已迁移到 `koduck-community-impl`）
- AI Service（已迁移到 `koduck-ai-impl`）

## 问题与阻塞

### 阻塞原因

Phase 3.2 的任务是瘦身 `koduck-core`，但前提是 Phase 2 的迁移任务已经完成。当前分析发现：

1. **Phase 2 未完成**: 大量业务代码仍在 `koduck-core` 中，尚未迁移到对应的 `*-impl` 模块
2. **代码依赖复杂**: `koduck-core` 中的代码与其他模块有复杂的依赖关系
3. **迁移工作量大**: 需要迁移约 20,000+ 行代码

### 建议的解决方案

**方案 1**: 先完成 Phase 2 的迁移任务，然后再进行 Phase 3.2
- 优点：按原计划执行，风险可控
- 缺点：需要更多时间

**方案 2**: 在 Phase 3.2 中同时完成迁移和瘦身
- 优点：可以并行处理
- 缺点：工作量大，风险高

**推荐**: 采用方案 1，先完成 Phase 2 的迁移任务。

## 决策

### 暂停 Phase 3.2

决定**暂停 Phase 3.2**，等待 Phase 2 完成后再继续。

### 调整后的任务计划

如果继续执行，Phase 3.2 将采用分阶段策略：

**Phase 3.2.1**: 迁移 Market 相关代码到 `koduck-market-impl`
- 迁移 provider, model, util 等
- 预估：2-3 天

**Phase 3.2.2**: 迁移 Backtest 相关代码到 `koduck-strategy-impl`
- 迁移 BacktestServiceImpl, 实体类, Repository 等
- 预估：2-3 天

**Phase 3.2.3**: 迁移 User/Credential/Auth 代码
- 迁移到 `koduck-auth` 或新建模块
- 预估：3-4 天

**Phase 3.2.4**: 最终清理和瘦身
- 删除已迁移的代码
- 更新 POM 依赖
- 验证所有模块编译和测试通过
- 预估：2-3 天

## 目标

- **当前代码行数**: ~28,589 行
- **最终目标（Phase 3.2.4）**: < 1,000 行
- **需要删除/迁移**: ~27,000+ 行

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ADR-0131-infrastructure-refactoring.md](./ADR-0131-infrastructure-refactoring.md)
- Issue #579

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
| 2026-04-06 | 暂停 Phase 3.2 | 发现 Phase 2 未完成，需要等待 |
