# ADR-0138: Portfolio N+1 查询优化

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

`PortfolioServiceImpl.getPortfolioSummary()` 方法在循环中逐个查询实时价格，导致 N+1 查询问题。如果有 N 个持仓，会产生 N 次价格查询，严重影响性能。

## 当前问题

### 代码分析

```java
@Override
@Cacheable(value = PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
public PortfolioSummaryDto getPortfolioSummary(Long userId) {
    List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
    for (PortfolioPosition position : positions) {
        // N 次查询 - 每次循环都查询一次价格
        Optional<BigDecimal> currentPriceOpt = priceService.getLatestPrice(
            position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        // ...
        // N 次查询 - 计算日盈亏时再次查询
        Optional<BigDecimal> dailyPnlOpt = calculatePositionDailyPnl(position, currentPrice);
        // ...
    }
}
```

### 问题影响

- 如果有 10 个持仓，会产生 20 次价格查询
- 响应时间随持仓数量线性增长
- 缓存命中率低，每次查询都是独立的缓存 key

## 决策

### 1. 添加批量查询接口

在 `PortfolioPriceService` 添加批量查询方法：

```java
/**
 * Get latest prices for multiple symbols in batch.
 *
 * @param symbols list of market-symbol pairs
 * @return map of symbol key to price
 */
Map<String, BigDecimal> getLatestPrices(List<SymbolKey> symbols);

/**
 * Get previous close prices for multiple symbols in batch.
 *
 * @param symbols list of market-symbol pairs
 * @return map of symbol key to price
 */
Map<String, BigDecimal> getPreviousClosePrices(List<SymbolKey> symbols);
```

### 2. 优化查询逻辑

修改 `getPortfolioSummary` 方法：

1. 一次性查询所有持仓
2. 提取所有唯一的 market+symbol 组合
3. 批量查询所有价格（2 次查询：当前价格 + 昨收价格）
4. 在内存中映射价格到持仓

### 3. 使用缓存优化

- 批量查询结果使用缓存
- 缓存 key 使用组合键
- 提高缓存命中率

## 优化效果

### 查询次数对比

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| 10 个持仓 | 20 次查询 | 2 次查询 |
| 50 个持仓 | 100 次查询 | 2 次查询 |
| 100 个持仓 | 200 次查询 | 2 次查询 |

### 响应时间目标

- 优化前：随持仓数量线性增长（100ms+）
- 优化后：恒定时间（< 50ms）

## 实现策略

### 数据模型

```java
/**
 * Symbol identifier for batch queries.
 */
public record SymbolKey(String market, String symbol) {
    public String toKey() {
        return market + ":" + symbol;
    }
}
```

### 批量查询实现

```java
@Override
public Map<String, BigDecimal> getLatestPrices(List<SymbolKey> symbols) {
    if (symbols.isEmpty()) {
        return Collections.emptyMap();
    }
    
    // Try cache first for all symbols
    Map<String, BigDecimal> result = new HashMap<>();
    List<SymbolKey> missingSymbols = new ArrayList<>();
    
    for (SymbolKey key : symbols) {
        String cacheKey = buildCacheKey(key);
        BigDecimal cachedPrice = cache.get(cacheKey);
        if (cachedPrice != null) {
            result.put(key.toKey(), cachedPrice);
        } else {
            missingSymbols.add(key);
        }
    }
    
    // Batch query missing prices
    if (!missingSymbols.isEmpty()) {
        Map<String, BigDecimal> fetchedPrices = batchQueryPrices(missingSymbols);
        result.putAll(fetchedPrices);
        
        // Cache fetched prices
        fetchedPrices.forEach((k, v) -> cache.put(buildCacheKey(k), v));
    }
    
    return result;
}
```

## 权衡

### 优点

1. **性能提升**: 查询次数从 N+1 减少到 2
2. **缓存优化**: 批量查询提高缓存命中率
3. **可扩展性**: 响应时间不再随持仓数量增长

### 缺点

1. **内存使用**: 需要缓存批量查询结果
2. **代码复杂度**: 批量查询逻辑比单个查询复杂
3. **缓存一致性**: 批量缓存需要考虑失效策略

## 兼容性影响

### 对现有代码的影响

- `PortfolioPriceService` 接口添加新方法
- `PortfolioServiceImpl` 修改查询逻辑
- 现有功能保持不变

### 迁移步骤

1. 添加批量查询接口
2. 实现批量查询逻辑
3. 修改 `getPortfolioSummary` 使用批量查询
4. 测试验证

## 相关文档

- Issue #600

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
