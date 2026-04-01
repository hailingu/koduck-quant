# ADR-0005: 市场领域 Mapper 合并（减少样板代码）

- Status: Accepted
- Date: 2026-04-01
- Issue: #300
- PR: #301

## Context

当前市场相关映射包含两个职责高度相近的薄 mapper：

- `MarketFlowMapper`：`MarketDailyNetFlow -> DailyNetFlowDto`
- `MarketBreadthMapper`：`MarketDailyBreadth -> DailyBreadthDto`

二者都仅承担单一 `toDto` 映射，长期会形成重复样板代码，增加注入点和维护负担。
项目已采用 MapStruct，不希望引入新框架，也不希望改变现有业务行为。

## Decision

在保持 MapStruct 的前提下，合并同领域的薄 mapper：

- 新增 `MarketDataMapper`，集中提供：
  - `toDto(MarketDailyNetFlow)`
  - `toDto(MarketDailyBreadth)`
- `MarketFlowServiceImpl` 与 `MarketBreadthServiceImpl` 统一注入 `MarketDataMapper`
- 删除 `MarketFlowMapper`、`MarketBreadthMapper`

## Consequences

正向影响：

- 减少 mapper 类数量与样板代码；
- 降低 service 层注入对象的分散度；
- 在不改行为的情况下完成代码组织优化。

代价：

- `MarketDataMapper` 的接口职责较单一 mapper 更宽；
- 后续若映射复杂度上升，需要再拆分以保持可维护性。

## Alternatives Considered

1. 保持现状（两个 mapper）  
   - 拒绝：重复样板代码继续累积，治理价值有限。

2. 全量重构所有 mapper 或替换 MapStruct  
   - 暂不采用：改动面过大，不符合本次低风险优化目标。

## Verification

- service 引用已切换到 `MarketDataMapper`；
- 旧 mapper 已删除；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
