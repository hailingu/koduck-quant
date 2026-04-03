# ADR-0049: Entity 层冗余消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #390

## Context

根据 `docs/entity-redundancy-analysis.md` 分析报告，koduck-backend 的 Entity 层存在完全冗余的枚举定义和数据字段。

### 发现的冗余问题

| 严重程度 | 问题 | 影响 |
|---------|------|------|
| 🔴 P0 | TradeType 枚举重复定义 | Trade.java 和 BacktestTrade.java 各自定义了完全相同的枚举 |
| 🔴 P0 | UserMemoryProfile.watchSymbols 与 WatchlistItem 功能重叠 | 数据不一致风险 |

## Decision

### 决策 1: 提取 TradeType 为共享枚举

**理由**:
- Trade.java 和 BacktestTrade.java 各自定义了完全相同的 TradeType 枚举（BUY, SELL）
- 属于代码级完全冗余，维护负担（改一处漏一处）

**实施方案**:
- 创建 `com.koduck.entity.enums.TradeType` 共享枚举
- 更新 Trade.java 引用新的枚举
- 更新 BacktestTrade.java 引用新的枚举

### 决策 2: 删除 UserMemoryProfile.watchSymbols 字段

**理由**:
- UserMemoryProfile.watchSymbols 是 JSONB 字符串数组
- WatchlistItem 是功能完备的实现（支持排序、备注、市场区分）
- 两者记录同一业务概念，数据不一致风险

**实施方案**:
- 删除 UserMemoryProfile.watchSymbols 字段
- 删除相关的 Builder 方法、getter/setter
- 如果 AI 需要快速读取关注列表，通过 WatchlistService 查询或缓存层解决

## Consequences

### 正向影响

- 消除重复枚举定义，降低维护成本
- 消除数据冗余，避免数据不一致
- 统一关注列表入口（WatchlistItem）

### 消极影响

- 如果 AI 功能依赖 watchSymbols 的快速读取，需要通过其他方式实现（如缓存）
- 需要更新数据库迁移脚本（可选，因为 JSONB 字段可为空）

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 数据库 | 无 | watchSymbols 是 JSONB，删除不影响其他字段 |
| API 接口 | 无 | Entity 是内部层 |
| Service 层 | 有 | 需要检查是否有使用 watchSymbols 的服务 |

## Related

- Issue #390
- `docs/entity-redundancy-analysis.md`
