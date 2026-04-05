# Performance Benchmarks

This directory contains JMH (Java Microbenchmark Harness) performance benchmarks for critical paths in the Koduck application.

## Running Benchmarks

### Run all benchmarks

```bash
cd koduck-backend
mvn test -pl koduck-bootstrap -Dtest="*Benchmark"
```

### Run specific benchmark

```bash
cd koduck-backend
mvn test -pl koduck-bootstrap -Dtest="MarketDataQueryBenchmark"
```

### Run with JMH CLI

```bash
cd koduck-backend/koduck-bootstrap
mvn test-compile exec:java \
  -Dexec.mainClass="org.openjdk.jmh.Main" \
  -Dexec.classpathScope=test \
  -Dexec.args="com.koduck.benchmark.MarketDataQueryBenchmark"
```

## Benchmarks

### MarketDataQueryBenchmark

Tests the performance of market data query operations.

| Test | Description | Target |
|------|-------------|--------|
| testSinglePriceQuery | Single price query | < 10 μs |
| testBatchPriceQuery10 | Batch query 10 symbols | < 50 μs |
| testBatchPriceQuery50 | Batch query 50 symbols | < 200 μs |

### PortfolioCalculationBenchmark

Tests the performance of portfolio calculation operations.

| Test | Description | Target |
|------|-------------|--------|
| testPortfolioSummaryCalculation10 | Summary for 10 positions | < 10 ms |
| testPortfolioSummaryCalculation50 | Summary for 50 positions | < 50 ms |
| testPositionPnlCalculation | Single position PnL | < 1 ms |

## Performance Baselines

### Initial Baseline (2026-04-06)

| Metric | Value | Notes |
|--------|-------|-------|
| Single price query | TBD | To be measured |
| Batch query (10) | TBD | To be measured |
| Portfolio summary (10) | TBD | To be measured |

## Interpreting Results

### Key Metrics

- **Average Time**: Mean execution time
- **Throughput**: Operations per unit time
- **Percentiles**: P50, P90, P99 response times

### Regression Thresholds

- Warning: > 20% degradation
- Error: > 50% degradation

## Notes

- Benchmarks are templates and need real service injection for accurate measurements
- Run benchmarks on dedicated hardware for consistent results
- Avoid running benchmarks alongside other resource-intensive processes
