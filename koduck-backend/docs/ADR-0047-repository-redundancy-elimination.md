# ADR-0047: Repository 层冗余消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #386

## Context

根据 `docs/repository-redundancy-analysis.md` 分析报告，koduck-backend 的 Repository 层存在死代码、重复方法和有 Bug 的方法。

### 发现的冗余问题

| 严重程度 | 问题 | 影响 |
|---------|------|------|
| 🔴 高 | `StockRealtimeRepository.findBySymbolInIgnoreCase()` | JPQL 参数错误，调用时必定报错 |
| 🔴 高 | `StockRealtimeRepository.findTopByGain/Loss(int)` | JPQL 不支持参数化 LIMIT |
| 🟡 中 | `StockRealtimeRepository` 4 个方法从未调用 | 增加维护成本 |
| 🟡 中 | `countAll()` 与继承的 `count()` 重复 | 代码噪音 |
| 🟡 中 | `findBySymbol()` 与 `findById()` 重复 | StockRealtime 的 @Id 就是 symbol |
| 🟡 中 | 三个信号 Repository 各 5 个方法从未调用 | 共 15 个死方法 |

## Decision

### 决策 1: 删除 StockRealtimeRepository 的死代码和 Bug 方法

**删除以下方法：**
- `findBySymbolIgnoreCase()` - 从未调用
- `findBySymbolInIgnoreCase()` - 有 Bug 且从未调用
- `findTopByGain(int)` - 有 Bug 且从未调用
- `findTopByLoss(int)` - 有 Bug 且从未调用
- `findTopByVolume(int)` - 虽然可能有用，但从未调用且参数化 LIMIT 有 Bug

**保留的方法：**
- `findBySymbol()` - 虽然与 `findById()` 重复，但语义更清晰，暂时保留
- `findFirstBySymbolOrderByUpdatedAtDesc()` - 使用中的方法
- `findBySymbolIn()` - 使用中的方法
- `findBySymbolInAndType()` - 使用中的方法
- `countAll()` - 将被替换为 `count()`
- `findDelayedStocks()` - 使用中的方法
- `countDelayedStocks()` - 使用中的方法

### 决策 2: 替换 countAll() 为继承的 count()

**理由：**
- `JpaRepository` 已提供 `count()` 方法，功能完全一致
- 减少自定义查询，降低维护成本

**实施方案：**
- 删除 `StockRealtimeRepository.countAll()`
- 更新 `MonitoringServiceImpl` 中的调用

### 决策 3: 删除三个信号 Repository 的死方法

**每个 Repository 保留的方法（实际使用）：**
- `existsBySignalIdAndUserId()` - 判断是否已操作
- `deleteBySignalIdAndUserId()` - 取消操作
- `findSignalIdsByUserId()` - 批量加载交互标记
- `save()` - 继承方法，创建记录

**SignalSubscriptionRepository 额外保留：**
- `findByUserId()` (List 版) - 获取我的订阅列表

**删除的方法（每个 Repository 5 个）：**
- `findBySignalIdAndUserId()` - 从未调用
- `findByUserId()` (Like/Favorite 的 List 版) - 从未调用
- `findByUserId()` (Subscription 的 Page 版) - 从未调用
- `findBySignalId()` - 从未调用
- `countBySignalId()` - 从未调用，计数通过 CommunitySignal 实体字段维护
- `countByUserId()` - 从未调用

## Consequences

### 正向影响

- 消除 19+ 个死代码方法，降低维护成本
- 修复 3 个有 Bug 的方法
- 减少代码噪音，提高可读性

### 消极影响

- 如果未来需要被删除的方法，需要重新实现
- 需要更新 Service 层的调用（countAll → count）

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 数据库 | 无 | 不涉及表结构变更 |
| API 接口 | 无 | Repository 是内部层 |
| Service 层 | 有 | 需要更新 countAll() 调用 |
| 测试 | 有 | 需要删除相关测试 |

## Related

- Issue #386
- `docs/repository-redundancy-analysis.md`
