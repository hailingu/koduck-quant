# ADR-0061: Controller 层业务逻辑下沉到 Service 层

- Status: Accepted
- Date: 2026-04-04
- Issue: #416

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的架构合理性评估，`MarketController` 中存在多处业务逻辑，违背了分层架构原则：

| 问题类型 | 位置 | 当前实现 |
|----------|------|----------|
| null 判断和错误组装 | getStockDetail() | `if (quote == null) return ApiResponse.error(...)` |
| null 判断和错误组装 | getStockStats() | `if (stats == null) return ApiResponse.error(...)` |
| null 判断和错误组装 | getStockValuation() | `if (valuation == null) return ApiResponse.error(...)` |
| null 判断和错误组装 | getStockIndustry() | `if (industry == null) return ApiResponse.error(...)` |
| null 判断和错误组装 | getDailyNetFlow() | `if (result == null) return ApiResponse.error(...)` |
| null 判断和错误组装 | getDailyBreadth() | `if (result == null) return ApiResponse.error(...)` |
| 日期范围验证 | getDailyNetFlowHistory() | `if (to.isBefore(from)) return ApiResponse.error(...)` |
| 日期范围验证 | getDailyBreadthHistory() | `if (to.isBefore(from)) return ApiResponse.error(...)` |
| 业务工具方法 | normalizeTimeframe() | Controller 中的时间周期转换逻辑 |

这些问题导致：
- **职责混乱**：Controller 应该只负责 HTTP 路由和响应包装
- **代码重复**：多个方法重复相同的 null 判断和错误组装模式
- **测试困难**：需要测试 Controller 的业务分支
- **异常处理不统一**：有的返回 error，有的应该抛异常

## Decision

### 1. null 判断和错误组装下沉

**修改前（Controller）：**
```java
@GetMapping("/stocks/{symbol}")
public ApiResponse<PriceQuoteDto> getStockDetail(String symbol) {
    PriceQuoteDto quote = marketService.getStockDetail(symbol);
    if (quote == null) {
        return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ...);
    }
    return ApiResponse.success(quote);
}
```

**修改后（Controller 仅负责路由）：**
```java
@GetMapping("/stocks/{symbol}")
public ApiResponse<PriceQuoteDto> getStockDetail(String symbol) {
    PriceQuoteDto quote = marketService.getStockDetail(symbol);
    return ApiResponse.success(quote);
}
```

**Service 层抛出异常：**
```java
@Override
public PriceQuoteDto getStockDetail(String symbol) {
    PriceQuoteDto quote = fetchQuote(symbol);
    if (quote == null) {
        throw new ResourceNotFoundException(ErrorCode.STOCK_NOT_FOUND, symbol);
    }
    return quote;
}
```

### 2. 日期范围验证下沉

**修改前（Controller）：**
```java
@GetMapping("/net-flow/daily/history")
public ApiResponse<List<DailyNetFlowDto>> getDailyNetFlowHistory(...) {
    if (to.isBefore(from)) {
        return ApiResponse.error(ApiStatusCodeConstants.BAD_REQUEST, ...);
    }
    List<DailyNetFlowDto> result = marketFlowService.getDailyNetFlowHistory(...);
    return ApiResponse.success(result);
}
```

**修改后（Service 层验证）：**
```java
@Override
public List<DailyNetFlowDto> getDailyNetFlowHistory(...) {
    if (to.isBefore(from)) {
        throw new ValidationException(ErrorCode.INVALID_DATE_RANGE);
    }
    // ... 业务逻辑
}
```

### 3. normalizeTimeframe 下沉

- 将 `normalizeTimeframe()` 方法从 `MarketController` 移动到 `MarketService`
- Controller 直接透传参数，不做任何转换

### 修改范围

| 文件 | 修改内容 |
|------|----------|
| MarketController.java | 移除 null 判断、日期验证、normalizeTimeframe 方法 |
| MarketService.java | getStockDetail() 添加 throws ResourceNotFoundException |
| MarketServiceImpl.java | 实现 null 检查并抛出 ResourceNotFoundException |
| MarketFlowService.java | getDailyNetFlow() 添加异常声明，getDailyNetFlowHistory() 添加日期验证 |
| MarketFlowServiceImpl.java | 实现 null 检查和日期验证 |
| MarketBreadthService.java | getDailyBreadth() 添加异常声明，getDailyBreadthHistory() 添加日期验证 |
| MarketBreadthServiceImpl.java | 实现 null 检查和日期验证 |

## Consequences

### 正向影响

- **职责清晰**：Controller 只负责 HTTP 路由，Service 负责业务逻辑
- **代码简洁**：Controller 方法更短，专注于请求处理和响应包装
- **异常统一**：所有异常通过全局异常处理器处理，响应格式一致
- **测试简化**：Controller 测试只需验证路由，业务逻辑在 Service 层测试

### 兼容性影响

- **API 行为不变**：对外暴露的 HTTP 接口行为完全一致
- **错误码不变**：404、400 等错误码和错误消息保持不变
- **内部实现变更**：异常从 Controller 转移到 Service 层抛出

## Alternatives Considered

1. **使用 Optional 替代异常**
   - 拒绝：`Optional` 在 Java 中主要用于返回值，对于"资源不存在"这种业务异常，抛出异常更符合语义
   - 当前方案：使用 `ResourceNotFoundException` 语义更清晰

2. **保留 Controller 中的简单验证**
   - 拒绝：即使是简单的日期验证，也属于业务规则，应该统一放在 Service 层
   - 当前方案：所有业务逻辑下沉到 Service 层

3. **使用 JSR-380 注解验证日期范围**
   - 拒绝：日期范围验证涉及两个字段的比较，使用注解实现较复杂
   - 当前方案：在 Service 层手动验证，清晰且易于维护

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
