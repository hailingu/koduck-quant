# ADR-0135: Entity and Repository Migration

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

Phase 3.2 已经删除了 koduck-core 中与 koduck-market-impl 重复的 Market Service 代码。但是 koduck-core 中仍然存在 Market 相关的 Entity 和 Repository，这些代码已经在 koduck-market-impl 中存在。

## 当前状态

### koduck-core 中的 Market Entity

- `com.koduck.entity.market.KlineData`
- `com.koduck.entity.market.StockBasic`
- `com.koduck.entity.market.StockRealtime`
- `com.koduck.entity.market.DataSourceStatus`
- `com.koduck.entity.market.MarketDailyNetFlow`
- `com.koduck.entity.market.MarketDailyBreadth`
- `com.koduck.entity.market.MarketSectorNetFlow`
- `com.koduck.entity.market.StockTickHistory`

### koduck-core 中的 Market Repository

- `com.koduck.repository.market.KlineDataRepository`
- `com.koduck.repository.market.StockBasicRepository`
- `com.koduck.repository.market.StockRealtimeRepository`
- `com.koduck.repository.market.DataSourceStatusRepository`
- `com.koduck.repository.market.MarketDailyNetFlowRepository`
- `com.koduck.repository.market.MarketDailyBreadthRepository`
- `com.koduck.repository.market.MarketSectorNetFlowRepository`
- `com.koduck.repository.market.StockTickHistoryRepository`

### koduck-market-impl 中的对应代码

上述所有 Entity 和 Repository 已经在 koduck-market-impl 中存在，只是包名不同：
- Entity: `com.koduck.market.entity.*`
- Repository: 目前仍在 koduck-core 中

## 决策

### 1. Entity 迁移策略

由于 koduck-market-impl 中已经有相同的 Entity，koduck-core 中的 Entity 只是包名不同（`com.koduck.entity.market` vs `com.koduck.market.entity`），需要：

1. 更新 koduck-core 中使用这些 Entity 的代码，改为使用 koduck-market-impl 中的 Entity
2. 删除 koduck-core 中的重复 Entity

### 2. Repository 迁移策略

Repository 接口需要保留在 koduck-core 或迁移到 koduck-infrastructure：

- 方案 1: 保留在 koduck-core，但更新为使用 koduck-market-impl 的 Entity
- 方案 2: 迁移到 koduck-infrastructure，实现技术适配器层

**决策**: 采用方案 1，Repository 暂时保留在 koduck-core，但更新 import 使用 koduck-market-impl 的 Entity。

### 3. 更新引用

需要更新以下文件中的 import：
- Repository 接口（更新 Entity import）
- Service 实现（更新 Entity import）
- Controller（更新 Entity import）
- Mapper（更新 Entity import）

## 权衡

### 优点

1. **消除重复代码**: 删除 koduck-core 和 koduck-market-impl 中的重复 Entity
2. **统一模型**: 所有 Market 相关代码使用统一的 Entity
3. **减少维护成本**: 避免维护两份相同的 Entity

### 缺点

1. **依赖增加**: koduck-core 需要依赖 koduck-market-impl 的 Entity
2. **重构风险**: 需要更新大量文件的 import

## 兼容性影响

### 对现有代码的影响

- 需要更新所有使用 `com.koduck.entity.market.*` 的 import
- 数据库表结构不变（Entity 字段相同）

### 迁移步骤

1. 更新 koduck-core 中使用 `com.koduck.entity.market.*` 的 import
2. 删除 koduck-core/src/main/java/com/koduck/entity/market/ 目录
3. 验证编译和测试通过

## 目标

- **当前 koduck-core 代码行数**: ~22,547 行
- **Phase 3.3 目标**: ~20,000 行（删除 ~2,500 行 Entity 代码）

## 相关文档

- [ADR-0132-core-slimming.md](./ADR-0132-core-slimming.md)
- [ADR-0134-core-slimming-implementation.md](./ADR-0134-core-slimming-implementation.md)
- Issue #592

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
