# ADR-0070: 使用滑动窗口预计算 MA 序列优化回测信号生成

- Status: Accepted
- Date: 2026-04-04
- Issue: #434

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的性能评估，`BacktestServiceImpl` 中 `generateSignal` 存在严重的 MA 重复计算问题。

### 当前实现分析

`executeBacktest` 循环中：
```java
for (int i = MINIMUM_BARS; i < filteredData.size(); i++) {
    List<KlineDataDto> history = filteredData.subList(0, i + 1);
    BacktestSignal signal = generateSignal(history);
}
```

`generateSignal` 内部：
```java
BigDecimal ma20 = calculateMA(history, MA_SHORT_PERIOD);
BigDecimal ma60 = calculateMA(history, MINIMUM_BARS);
List<KlineDataDto> prevHistory = history.subList(0, history.size() - 1);
BigDecimal prevMa20 = calculateMA(prevHistory, MA_SHORT_PERIOD);
BigDecimal prevMa60 = calculateMA(prevHistory, MINIMUM_BARS);
```

问题：
- 每根 K 线调用 4 次 `calculateMA`，每次遍历 `period` 个元素
- `ma20` 与 `prevMa20` 有 19/20 的数据重叠，`ma60` 与 `prevMa60` 有 59/60 的数据重叠
- 时间复杂度从 O(n) 退化到 O(4np) ≈ O(n × p)
- 当 n = 1000，p = 60 时，约产生 24 万次 `BigDecimal` 加法，而优化后只需约 1000 次

## Decision

### 1. 预计算 MA 序列

在 `executeBacktest` 中，循环开始前预先计算整段数据的 MA20 序列和 MA60 序列，存储为 `List<BigDecimal>`。

新增私有方法 `calculateMASeries`：
```java
private List<BigDecimal> calculateMASeries(List<KlineDataDto> data, int period) {
    List<BigDecimal> series = new ArrayList<>(data.size());
    BigDecimal sum = BigDecimal.ZERO;
    for (int i = 0; i < data.size(); i++) {
        sum = sum.add(data.get(i).close());
        if (i >= period) {
            sum = sum.subtract(data.get(i - period).close());
        }
        if (i >= period - 1) {
            series.add(sum.divide(BigDecimal.valueOf(period), SCALE, RoundingMode.HALF_UP));
        } else {
            series.add(data.get(i).close());
        }
    }
    return series;
}
```

### 2. 修改 generateSignal 方法签名

将 `generateSignal(List<KlineDataDto> history)` 改为接收当前和前一根的预计算 MA 值：
```java
private BacktestSignal generateSignal(BigDecimal ma20, BigDecimal ma60,
                                      BigDecimal prevMa20, BigDecimal prevMa60)
```

循环中直接查表：
```java
BigDecimal ma20 = ma20Series.get(i);
BigDecimal ma60 = ma60Series.get(i);
BigDecimal prevMa20 = ma20Series.get(i - 1);
BigDecimal prevMa60 = ma60Series.get(i - 1);
BacktestSignal signal = generateSignal(ma20, ma60, prevMa20, prevMa60);
```

### 3. 保留 calculateMA 方法

`calculateMA` 继续保留，供 `calculateMetrics` 中的最终价格计算或其他潜在用途使用。

### 4. 行为完全等价

滑动窗口的数学公式与逐次求和完全一致，因为：
```
MA[i] = (close[i-period+1] + ... + close[i]) / period
MA[i+1] = (close[i-period+2] + ... + close[i+1]) / period
        = MA[i] - close[i-period+1] / period + close[i+1] / period
```

使用增量求和 `sum = sum - old + new` 后再除以 `period`，结果与完整求和完全相同。

## Consequences

### 正向影响

- **性能提升 1-2 个数量级**：回测循环中的 MA 计算从 O(n × p) 降到 O(n)
- **减少 BigDecimal 运算**：消除大量冗余的加法和除法
- **降低 GC 压力**：不再每次循环创建 `subList` 和临时求和对象
- **代码更清晰**：`generateSignal` 的职责更纯粹，只负责信号判断逻辑

### 兼容性影响

- **回测结果完全一致**：滑动窗口数学等价于逐次求和，信号产生时机不变
- **API 变化仅限内部私有方法**：`generateSignal` 签名改变，但无外部调用方
- **无数据库或 DTO 变更**：纯算法优化，不影响持久化或接口

## Alternatives Considered

1. **在循环内维护 running sum 状态变量**
   - 拒绝：需要在 `executeBacktest` 中维护 4 个 `sum` 变量（ma20 sum、ma60 sum 及其前一个值），代码可读性较差
   - 当前方案：预计算序列，循环内查表，逻辑更清晰

2. **保留现有实现**
   - 拒绝：性能缺陷明显，且优化改动小、风险低，属于典型的低垂果实
   - 当前方案：预计算 MA 序列

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- `BacktestServiceImplTest` 全部通过
- 新增 `calculateMASeries` 与 `calculateMA` 结果一致性测试
