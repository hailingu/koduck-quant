# ADR-0064: 提取 withFallback 模板方法统一降级策略

- Status: Accepted
- Date: 2026-04-04
- Issue: #422

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的可维护性评估，`MarketServiceImpl` 中存在 fallback 逻辑重复问题：

| 问题类型 | 位置 | 当前实现 |
|----------|------|----------|
| fallback 逻辑重复 | `getStockDetail()` | 正常路径和异常路径包含完全相同的 fallback 链 |
| fallback 逻辑重复 | `getStockStats()` | 正常路径和异常路径包含完全相同的 fallback 链 |

### 具体重复分析

**`getStockDetail()` 方法（第 137-186 行）：**

正常路径（entity == null）：
```java
PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
if (fallbackQuote != null) {
    return fallbackQuote;
}

PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
if (providerQuote != null) {
    return providerQuote;
}

throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
```

异常路径（catch 块）- **完全相同的代码**：
```java
PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
if (fallbackQuote != null) {
    return fallbackQuote;
}

PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
if (providerQuote != null) {
    return providerQuote;
}

throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
```

**`getStockStats()` 方法（第 350-402 行）：**
同样存在 `tryBuildStatsFromKline()` → `fetchProviderPrice()` → 异常抛出的重复 fallback 链。

这些问题导致：
- **代码重复**：相同的 fallback 逻辑在两个地方维护
- **维护困难**：修改 fallback 策略需要修改多处
- **测试冗余**：需要对相同的逻辑进行多次测试
- **可读性下降**：核心逻辑被重复代码掩盖

## Decision

### 1. 提取通用 fallback 模板方法

为 `getStockDetail()` 提取 `withQuoteFallback()` 方法：

**修改前：**
```java
@Override
public PriceQuoteDto getStockDetail(String symbol) {
    // ... 参数校验
    try {
        StockRealtime entity = stockRealtimeRepository
                .findFirstBySymbolOrderByUpdatedAtDesc(symbol)
                .orElse(null);
        if (entity == null) {
            // fallback 链 1（与 catch 块重复）
            PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
            if (fallbackQuote != null) return fallbackQuote;
            
            PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
            if (providerQuote != null) return providerQuote;
            
            throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
        }
        return marketServiceSupport.mapToPriceQuoteDto(entity);
    } catch (RuntimeException e) {
        // fallback 链 2（与上面重复）
        PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
        if (fallbackQuote != null) return fallbackQuote;
        
        PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
        if (providerQuote != null) return providerQuote;
        
        throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
    }
}
```

**修改后：**
```java
@Override
public PriceQuoteDto getStockDetail(String symbol) {
    // ... 参数校验
    return withQuoteFallback(symbol, () -> {
        StockRealtime entity = stockRealtimeRepository
                .findFirstBySymbolOrderByUpdatedAtDesc(symbol)
                .orElse(null);
        if (entity == null) {
            return null;
        }
        return marketServiceSupport.mapToPriceQuoteDto(entity);
    });
}

private PriceQuoteDto withQuoteFallback(String symbol, Supplier<PriceQuoteDto> primaryFetcher) {
    try {
        PriceQuoteDto result = primaryFetcher.get();
        if (result != null) {
            return result;
        }
    } catch (RuntimeException e) {
        log.error("Error fetching stock detail: symbol={}, error={}", symbol, e.getMessage(), e);
    }
    
    // Fallback 1: try kline data
    PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
    if (fallbackQuote != null) {
        log.info("Recovered stock detail from kline: symbol={}", symbol);
        return fallbackQuote;
    }
    
    // Fallback 2: try provider
    PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
    if (providerQuote != null) {
        log.info("Recovered stock detail from provider: symbol={}", symbol);
        return providerQuote;
    }
    
    throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
}
```

### 2. 提取 `getStockStats()` 的 fallback 方法

同样方式提取 `withStatsFallback()` 方法，消除 `getStockStats()` 中的重复逻辑。

### 3. 日志优化

- 统一在模板方法中记录 fallback 成功日志
- 异常日志只在 catch 块中记录一次
- 不同 fallback 层级使用不同的日志级别

## Consequences

### 正向影响

- **代码简洁**：消除重复代码，核心逻辑更清晰
- **维护容易**：fallback 策略集中在一处，修改只需改一个地方
- **测试简化**：只需测试模板方法一次，无需重复测试相同的 fallback 链
- **扩展方便**：后续添加新的 fallback 层级（如缓存）只需修改模板方法

### 兼容性影响

- **API 行为不变**：对外暴露的 HTTP 接口行为完全一致
- **错误码不变**：`ResourceNotFoundException` 的错误码保持不变
- **日志信息优化**：fallback 成功时的日志统一在模板方法中记录，更一致
- **内部实现变更**：fallback 逻辑从分散在多处集中到统一的模板方法

## Alternatives Considered

1. **使用函数式接口链式调用**
   - 拒绝：链式调用虽然优雅，但会增加理解成本，对于只有两层 fallback 的场景过于复杂
   - 当前方案：使用传统的 if-else 模式，清晰易懂

2. **保留现有代码**
   - 拒绝：重复代码违反 DRY 原则，后续维护成本高
   - 当前方案：提取模板方法消除重复

3. **使用 Resilience4j 的降级机制**
   - 拒绝：当前 fallback 逻辑涉及多个数据源切换，不是简单的超时重试场景
   - 当前方案：保持手动 fallback 控制，更灵活

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有现有单元测试通过
