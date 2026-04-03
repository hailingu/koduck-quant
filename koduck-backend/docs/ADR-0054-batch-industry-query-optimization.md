# ADR-0054: 批量行业查询 N+1 问题优化

- Status: Accepted
- Date: 2026-04-04
- Issue: #400
- PR: (待定)

## Context

`MarketServiceImpl.getStockIndustries(List<String> symbols)` 方法存在 N+1 查询问题：

```java
// 当前实现（问题代码）
for (String symbol : symbols) {
    StockIndustryDto industry = getStockIndustry(symbol);  // N 次串行调用
}
```

当传入 100 个股票代码时，会发起 100 次串行网络请求（通过 `data-service`），性能随股票数量线性下降（O(N)）。

## Decision

采用 **批量查询 + 并行化混合策略** 优化：

1. **优先批量查询**：改造底层调用，使用 `POST /api/industries/batch` 一次性获取多个行业数据
2. **降级并行化**：对于无法批量查询的场景，使用 `@Async` + `CompletableFuture` 并行发起请求
3. **本地缓存缓冲**：对于行业这种准静态数据，启用 Caffeine 本地缓存减少热点查询

具体实现方案：

- 新增 `fetchProviderIndustriesBatch(List<String> symbols)` 批量获取方法
- `getStockIndustries()` 改为先尝试批量接口，失败时降级为并行单条查询
- 保持方法签名不变（向后兼容）

## Consequences

正向影响：

- 批量查询场景：时间复杂度从 O(N) 降到 O(1)，网络往返次数大幅减少
- 降级场景：并行化可将耗时从 `N × T` 降到约 `max(T)`（T 为单次请求耗时）
- 缓存命中时：直接内存返回，零网络开销

代价：

- 代码复杂度略有增加（批量接口 + 降级逻辑）
- 需要确保批量接口的可用性和超时设置合理

## Alternatives Considered

1. **仅使用 @Async + CompletableFuture 并行化**
   - 拒绝：虽然能缩短总耗时，但仍消耗 N 次连接资源，对下游服务压力未减轻

2. **仅依赖本地缓存**
   - 拒绝：行业数据虽准静态但可能变更，仅依赖缓存可能导致数据不一致

3. **数据库 JOIN 查询**
   - 暂不采用：行业数据存储在 `data-service`，非本地数据库，无法直接 JOIN

## Compatibility

- 方法签名保持不变：`Map<String, StockIndustryDto> getStockIndustries(List<String> symbols)`
- 返回结果格式不变，对调用方完全透明
- 仅内部实现从串行改为批量/并行

## Verification

- 单元测试验证批量查询逻辑正确性
- 集成测试验证降级路径正常工作
- 质量检查通过：`./scripts/quality-check.sh`
