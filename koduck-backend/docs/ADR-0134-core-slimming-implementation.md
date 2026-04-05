# ADR-0134: koduck-core 瘦身实施

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

根据 ADR-0132，koduck-core 模块包含了大量的业务逻辑代码（约 28,589 行）。随着 Phase 2.x 的完成，Market 相关代码已经迁移到 koduck-market-impl 模块。现在需要继续瘦身 koduck-core，移除已迁移的代码。

## 决策

### 1. 删除已迁移的 Market 代码

koduck-core 中以下代码已迁移到 koduck-market-impl，可以安全删除：

- `com.koduck.market.MarketType` → 已存在于 koduck-market-api
- `com.koduck.market.model.*` → 已存在于 koduck-market-impl
- `com.koduck.market.provider.*` → 已存在于 koduck-market-impl
- `com.koduck.market.util.*` → 已存在于 koduck-market-impl

### 2. 删除已迁移的 Service 代码

以下 Service 已迁移到 koduck-market-impl：

- `com.koduck.service.KlineService` → 已存在于 koduck-market-impl
- `com.koduck.service.KlineSyncService` → 已存在于 koduck-market-impl
- `com.koduck.service.StockCacheService` → 已存在于 koduck-market-impl
- `com.koduck.service.StockSubscriptionService` → 已存在于 koduck-market-impl
- `com.koduck.service.SyntheticTickService` → 已存在于 koduck-market-impl
- `com.koduck.service.TechnicalIndicatorService` → 已存在于 koduck-market-impl
- `com.koduck.service.TickStreamService` → 已存在于 koduck-market-impl

### 3. 删除已迁移的 Support 代码

- `com.koduck.service.market.support.*` → 已存在于 koduck-market-impl

### 4. 保留的代码

以下代码需要保留在 koduck-core：

- Controller 层（暂时保留，后续迁移到 gateway 或各模块）
- Repository 接口（暂时保留，后续迁移到 infrastructure）
- Entity（暂时保留，后续迁移到各模块）
- 未迁移的 Service 实现（User, Auth, Credential, Backtest 等）

## 权衡

### 优点

1. **减少重复代码**: 删除 koduck-core 和 koduck-market-impl 中的重复代码
2. **明确职责**: koduck-core 只保留未迁移的业务逻辑
3. **减少维护成本**: 避免维护两份相同的代码

### 缺点

1. **依赖复杂**: 需要确保 koduck-core 中的代码正确引用 koduck-market-impl
2. **测试影响**: 需要验证删除后所有功能正常

## 兼容性影响

### 对现有代码的影响

- koduck-core 中的代码需要更新 import 引用
- 需要确保 koduck-market-impl 中的 Service 被正确注入

### 迁移步骤

1. 删除 koduck-core/src/main/java/com/koduck/market/ 目录
2. 删除 koduck-core/src/main/java/com/koduck/service/KlineService.java 等
3. 删除 koduck-core/src/main/java/com/koduck/service/market/support/ 目录
4. 更新 koduck-core 中引用这些类的 import
5. 验证编译和测试通过

## 目标

- **当前代码行数**: ~28,589 行
- **Phase 3.2 目标**: ~20,000 行（删除 ~8,000 行 Market 相关代码）

## 相关文档

- [ADR-0132-core-slimming.md](./ADR-0132-core-slimming.md)
- [ADR-0133-infrastructure-repository-implementation.md](./ADR-0133-infrastructure-repository-implementation.md)
- Issue #579

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
