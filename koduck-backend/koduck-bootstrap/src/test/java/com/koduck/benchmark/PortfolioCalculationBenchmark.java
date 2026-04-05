package com.koduck.benchmark;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Fork;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.Threads;
import org.openjdk.jmh.annotations.Warmup;

/**
 * Portfolio calculation performance benchmark.
 * Tests the performance of portfolio summary calculations.
 *
 * @author Koduck Team
 */
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
@Threads(1)
@State(Scope.Benchmark)
public class PortfolioCalculationBenchmark {

    /** Scale for BigDecimal calculations. */
    private static final int SCALE = 4;

    /** Percentage multiplier. */
    private static final int PERCENTAGE_MULTIPLIER = 100;

    /** Test positions data. */
    private List<TestPosition> testPositions;

    /**
     * Test position data holder.
     */
    private record TestPosition(String market, String symbol,
                                 BigDecimal avgCost, BigDecimal quantity,
                                 BigDecimal currentPrice) {
    }

    /**
     * Setup method - initializes test data.
     */
    @Setup
    public void setup() {
        // Initialize test positions (simulating 10 positions)
        testPositions = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            testPositions.add(new TestPosition(
                    "US",
                    "AAPL" + i,
                    BigDecimal.valueOf(100.0 + i * 10),
                    BigDecimal.valueOf(100),
                    BigDecimal.valueOf(110.0 + i * 5)
            ));
        }
    }

    /**
     * Benchmark portfolio summary calculation for 10 positions.
     * Simulates the calculation logic without N+1 queries.
     */
    @Benchmark
    public void testPortfolioSummaryCalculation10() {
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;

        for (TestPosition position : testPositions) {
            BigDecimal cost = position.avgCost.multiply(position.quantity);
            BigDecimal marketValue = position.currentPrice.multiply(position.quantity);
            totalCost = totalCost.add(cost);
            totalMarketValue = totalMarketValue.add(marketValue);
        }

        BigDecimal totalPnl = totalMarketValue.subtract(totalCost);
        BigDecimal totalPnlPercent = totalCost.compareTo(BigDecimal.ZERO) > 0
                ? totalPnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                        .divide(totalCost, SCALE, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Prevent optimization
        if (totalPnlPercent.compareTo(BigDecimal.ZERO) < 0) {
            throw new AssertionError("PnL should not be negative in this test");
        }
    }

    /**
     * Benchmark portfolio summary calculation for 50 positions.
     * Simulates larger portfolio calculation.
     */
    @Benchmark
    public void testPortfolioSummaryCalculation50() {
        List<TestPosition> largePortfolio = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            largePortfolio.add(new TestPosition(
                    "US",
                    "SYM" + i,
                    BigDecimal.valueOf(50.0 + i * 2),
                    BigDecimal.valueOf(10 + i % 100),
                    BigDecimal.valueOf(55.0 + i * 2.5)
            ));
        }

        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;

        for (TestPosition position : largePortfolio) {
            BigDecimal cost = position.avgCost.multiply(position.quantity);
            BigDecimal marketValue = position.currentPrice.multiply(position.quantity);
            totalCost = totalCost.add(cost);
            totalMarketValue = totalMarketValue.add(marketValue);
        }

        BigDecimal totalPnl = totalMarketValue.subtract(totalCost);
        BigDecimal totalPnlPercent = totalCost.compareTo(BigDecimal.ZERO) > 0
                ? totalPnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                        .divide(totalCost, SCALE, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Prevent optimization
        if (totalPnlPercent.compareTo(BigDecimal.ZERO) < 0) {
            throw new AssertionError("PnL should not be negative in this test");
        }
    }

    /**
     * Benchmark position PnL calculation.
     * Tests individual position calculation performance.
     */
    @Benchmark
    public void testPositionPnlCalculation() {
        TestPosition position = testPositions.get(0);

        BigDecimal cost = position.avgCost.multiply(position.quantity);
        BigDecimal marketValue = position.currentPrice.multiply(position.quantity);
        BigDecimal pnl = marketValue.subtract(cost);
        BigDecimal pnlPercent = cost.compareTo(BigDecimal.ZERO) > 0
                ? pnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                        .divide(cost, SCALE, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Prevent optimization
        if (pnlPercent == null) {
            throw new AssertionError("PnL percent should not be null");
        }
    }

    /**
     * Main method to run the benchmark.
     *
     * @param args command line arguments
     * @throws Exception if benchmark fails
     */
    public static void main(String[] args) throws Exception {
        org.openjdk.jmh.Main.main(args);
    }
}
