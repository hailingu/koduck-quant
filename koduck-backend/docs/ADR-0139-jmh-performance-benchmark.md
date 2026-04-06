# ADR-0139: JMH 性能基准测试

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

随着架构改进和模块拆分，需要建立性能基准来量化关键路径的性能指标，检测性能退化，并为优化提供数据支持。

## 目标

1. 使用 JMH (Java Microbenchmark Harness) 建立关键路径的性能基准
2. 量化核心功能的性能指标
3. 建立性能退化检测机制
4. 为后续优化提供数据支持

## 决策

### 1. 使用 JMH 框架

选择 JMH 作为性能测试框架，原因：
- 是 OpenJDK 官方推荐的微基准测试框架
- 自动处理 JVM 预热、垃圾回收等干扰因素
- 提供丰富的统计指标（吞吐量、平均时间、百分位数等）
- 与 Maven 集成良好

### 2. 基准测试范围

**关键路径识别:**
- Market 数据查询（高频操作）
- Portfolio 组合计算（计算密集型）

**不测试的内容:**
- 数据库查询性能（使用独立的数据库性能测试）
- 网络延迟（使用集成测试覆盖）
- 前端性能（不属于后端范畴）

### 3. 测试方法

**吞吐量测试 (Throughput):**
- 单位时间内完成的操作数
- 适用于高并发场景

**平均时间测试 (AverageTime):**
- 单次操作的平均耗时
- 适用于延迟敏感场景

**采样测试 (SampleTime):**
- 收集大量样本计算百分位数
- 适用于稳定性评估

### 4. 基准配置

```java
@BenchmarkMode(Mode.AverageTime)  // 测试平均耗时
@OutputTimeUnit(TimeUnit.MICROSECONDS)  // 输出单位：微秒
@Warmup(iterations = 3, time = 1)  // 预热 3 轮，每轮 1 秒
@Measurement(iterations = 5, time = 1)  // 测量 5 轮，每轮 1 秒
@Fork(1)  // 使用 1 个 JVM 进程
@Threads(1)  // 单线程测试
```

## 实现策略

### 项目结构

```
koduck-bootstrap/src/test/java/com/koduck/benchmark/
├── MarketDataQueryBenchmark.java
├── PortfolioCalculationBenchmark.java
└── README.md
```

### 依赖配置

在 `koduck-bootstrap/pom.xml` 添加：

```xml
<dependency>
    <groupId>org.openjdk.jmh</groupId>
    <artifactId>jmh-core</artifactId>
    <version>1.37</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.openjdk.jmh</groupId>
    <artifactId>jmh-generator-annprocess</artifactId>
    <version>1.37</version>
    <scope>test</scope>
</dependency>
```

### 基准测试示例

```java
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
public class MarketDataQueryBenchmark {

    @Benchmark
    public void testGetLatestPrice() {
        // 测试代码
    }
}
```

## 性能基线

### 初始基线（建立时记录）

| 测试项 | 目标性能 | 备注 |
|--------|----------|------|
| getLatestPrice | < 10 μs | 单次查询 |
| getLatestPrices (10) | < 50 μs | 批量查询 10 个 |
| getPortfolioSummary (10) | < 100 ms | 10 个持仓 |

### 退化阈值

- 吞吐量下降 > 20%：警告
- 延迟增加 > 50%：错误

## 权衡

### 优点

1. **量化性能**: 提供客观的性能指标
2. **防止退化**: 及时发现性能回归
3. **优化指导**: 为优化提供数据支持
4. **文档化**: 基准测试本身就是性能文档

### 缺点

1. **运行时间**: 基准测试运行时间较长
2. **环境敏感**: 结果受运行环境影响
3. **维护成本**: 需要随代码更新维护

## 兼容性影响

### 对现有代码的影响

- 无侵入性，仅添加测试代码
- 不修改业务逻辑

### CI 集成

- 性能测试不阻断 CI（运行时间较长）
- 定期运行（如每日构建）

## 相关文档

- [JMH 官方文档](https://openjdk.org/projects/code-tools/jmh/)
- Issue #602

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
