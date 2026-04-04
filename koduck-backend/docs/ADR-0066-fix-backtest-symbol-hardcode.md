# ADR-0066: 修复 BacktestServiceImpl 交易记录 symbol 硬编码问题

- Status: Accepted
- Date: 2026-04-04
- Issue: #426

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的数据正确性评估，`BacktestServiceImpl` 中存在 symbol 硬编码问题：

| 问题类型 | 位置 | 当前实现 |
|----------|------|----------|
| symbol 硬编码 | `executeBuy()` 第 313 行 | `.symbol("SYMBOL")` |
| symbol 硬编码 | `executeSell()` 第 349 行 | `.symbol("SYMBOL")` |

### 具体问题分析

在 `executeBacktest(BacktestResult result)` 方法中，`result.getSymbol()` 已经保存了用户传入的实际股票代码（如 `000001`、`600519`）。然而，`executeBuy` 和 `executeSell` 在构建 `BacktestTrade` 时，未接收该股票代码，而是直接硬编码为 `"SYMBOL"`：

```java
return BacktestTrade.builder()
    .backtestResultId(backtestResultId)
    .tradeType(TradeType.BUY)
    // ...
    .symbol("SYMBOL")  // 硬编码
    // ...
    .build();
```

这导致：
- **数据正确性缺陷**：所有回测交易记录的 `symbol` 字段都是 `"SYMBOL"`，无法区分不同标的
- **查询分析失效**：按股票代码筛选、统计、报表时结果混乱
- **回测结果无意义**：多标的回测数据混在一起，无法用于后续策略优化

## Decision

### 1. 修改 `executeBuy` / `executeSell` 方法签名

为两个方法增加 `String symbol` 参数，使其能够接收实际股票代码：

**修改前：**
```java
private BacktestTrade executeBuy(BacktestExecutionContext context, KlineDataDto current,
                                 Long backtestResultId)

private BacktestTrade executeSell(BacktestExecutionContext context, KlineDataDto current,
                                  Long backtestResultId)
```

**修改后：**
```java
private BacktestTrade executeBuy(BacktestExecutionContext context, KlineDataDto current,
                                 Long backtestResultId, String symbol)

private BacktestTrade executeSell(BacktestExecutionContext context, KlineDataDto current,
                                  Long backtestResultId, String symbol)
```

### 2. 替换硬编码为传入参数

将 builder 中的 `.symbol("SYMBOL")` 替换为 `.symbol(symbol)`。

### 3. 更新调用点

在 `executeBacktest` 方法中，调用这两个方法时传入 `result.getSymbol()`：

```java
BacktestTrade trade = executeBuy(context, current, result.getId(), result.getSymbol());
// ...
BacktestTrade trade = executeSell(context, current, result.getId(), result.getSymbol());
```

### 4. 添加回归测试

新增 `BacktestServiceImplTest`：
- 使用 Mockito 对 `BacktestServiceImpl` 的依赖进行 mock
- 通过 `ReflectionTestUtils.invokeMethod` 调用私有方法 `executeBuy` / `executeSell`
- 断言返回的 `BacktestTrade.symbol` 与传入的实际股票代码一致

## Consequences

### 正向影响

- **数据正确性恢复**：交易记录能够正确关联到实际股票代码
- **多标的回测可用**：支持不同 symbol 的回测结果独立存储和分析
- **修改范围极小**：仅涉及两个私有方法签名和两处调用点，零外部 API 变更

### 兼容性影响

- **API 行为不变**：HTTP 接口、DTO、数据库表结构均无变化
- **内部方法签名变更**：`executeBuy` / `executeSell` 增加 `symbol` 参数，但均为私有方法，不影响外部调用方
- **数据修复**：历史已产生的 `"SYMBOL"` 记录需通过数据修复脚本处理（不在本次范围内）

## Alternatives Considered

1. **将 symbol 放入 `BacktestExecutionContext`**
   - 拒绝：`BacktestExecutionContext` 的职责是维护资金、仓位、成本等交易状态，股票代码不属于"执行上下文"，放入其中会混淆职责边界
   - 当前方案：通过方法参数显式传递，职责清晰

2. **保持硬编码，由上游修正**
   - 拒绝：在 `executeBacktest` 循环结束后遍历 trades 再 setSymbol 是事后补丁，容易遗漏且不符合最小惊讶原则
   - 当前方案：在构造交易记录时直接使用正确数据

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 新增单元测试通过，验证 `executeBuy` / `executeSell` 的 `symbol` 字段正确性
