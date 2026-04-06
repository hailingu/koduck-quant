# ADR-0048: Service 层冗余消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #388

## Context

根据 `docs/service-redundancy-analysis.md` 分析报告，koduck-backend 的 Service 层存在完全冗余的接口和 DTO。

### 发现的冗余问题

| 严重程度 | 问题 | 影响 |
|---------|------|------|
| 🔴 P0 | ProfileService 与 UserService 功能完全重叠 | 维护两套相似的接口和 DTO |
| 🔴 P0 | KlineMinutesService 是 KlineService 的功能子集 | 不必要的服务分裂 |
| 🔴 P0 | StockSubscriptionService 内嵌 DTO 重复 | PriceUpdate 与 PriceUpdateMessage.PriceData 完全相同 |

## Decision

### 决策 1: 删除 ProfileService

**理由**:
- ProfileService 只有两个方法（getProfile/updateProfile）
- 与 UserService 的 getCurrentUser/updateProfile 功能完全对应
- 两者读取同一 User 实体，只是返回不同 DTO
- ProfileController 已被删除，ProfileService 无调用方

**实施方案**:
- 删除 ProfileService 接口
- 删除 ProfileServiceImpl 实现

### 决策 2: 合并 KlineMinutesService 到 KlineService

**理由**:
- KlineMinutesService.getMinuteKline 与 KlineService.getKlineData 方法签名几乎一致
- 返回类型完全相同（List<KlineDataDto>）
- 唯一区别是数据源不同（外部服务 vs 本地 DB）
- 属于实现细节，不应暴露为独立接口

**实施方案**:
- 删除 KlineMinutesService 接口
- 删除 KlineMinutesServiceImpl 实现
- 将功能合并到 KlineService/KlineServiceImpl
- isMinuteTimeframe 作为 KlineService 的 default 方法

### 决策 3: 提取 PriceUpdate 为独立 DTO

**理由**:
- PriceUpdate 和 PriceUpdateMessage.PriceData 有完全相同的 6 个字段
- 内嵌在 Service 接口中违反分层原则
- DTO 应该放在 dto/ 包中

**实施方案**:
- 创建 dto/market/PriceUpdateDto.java
- 删除 StockSubscriptionService.PriceUpdate 内嵌类
- 删除 StockSubscriptionService.PriceUpdateMessage.PriceData 内嵌类
- 更新 StockSubscriptionService 引用新的 DTO

## Consequences

### 正向影响

- 消除冗余 Service 接口，降低维护成本
- 统一 K 线数据查询入口
- 消除重复 DTO 定义
- 符合分层架构原则

### 消极影响

- 如果未来需要独立的分钟级 K 线服务，需要重新设计
- 需要更新所有调用方（当前无直接调用方）

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 无 | Service 是内部层 |
| 数据库 | 无 | 不涉及表结构变更 |
| Controller | 无 | ProfileController 已被删除，无其他调用方 |

## Related

- Issue #388
- `docs/service-redundancy-analysis.md`
