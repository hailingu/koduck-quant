package com.koduck.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.backtest.BacktestTrade;
import com.koduck.mapper.BacktestTradeMapper;
import com.koduck.repository.backtest.BacktestResultRepository;
import com.koduck.repository.backtest.BacktestTradeRepository;
import com.koduck.repository.strategy.StrategyRepository;
import com.koduck.repository.strategy.StrategyVersionRepository;
import com.koduck.service.impl.BacktestServiceImpl;
import com.koduck.service.support.BacktestExecutionContext;
import com.koduck.service.support.BacktestSignal;
import com.koduck.service.support.StrategyAccessSupport;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link BacktestServiceImpl}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class BacktestServiceImplTest {

    /**
     * Test stock symbol.
     */
    private static final String TEST_SYMBOL = "000001";

    /**
     * Test backtest result id.
     */
    private static final Long BACKTEST_RESULT_ID = 1L;

    /**
     * Commission rate for testing.
     */
    private static final BigDecimal COMMISSION_RATE = new BigDecimal("0.001");

    /**
     * Slippage for testing.
     */
    private static final BigDecimal SLIPPAGE = new BigDecimal("0.001");

    /**
     * Initial capital for testing.
     */
    private static final BigDecimal INITIAL_CAPITAL = new BigDecimal("100000");

    /**
     * Test trade price.
     */
    private static final BigDecimal TEST_PRICE = BigDecimal.TEN;

    /**
     * Test sell trade price.
     */
    private static final BigDecimal TEST_SELL_PRICE = new BigDecimal("11");

    /**
     * Test trade volume.
     */
    private static final long TEST_VOLUME = 100L;

    /**
     * Test trade amount for buy.
     */
    private static final BigDecimal TEST_AMOUNT_BUY = new BigDecimal("1000");

    /**
     * Test trade amount for sell.
     */
    private static final BigDecimal TEST_AMOUNT_SELL = new BigDecimal("1100");

    /**
     * Test position size.
     */
    private static final BigDecimal TEST_POSITION = new BigDecimal("1000");

    /**
     * Test entry price.
     */
    private static final BigDecimal TEST_ENTRY_PRICE = BigDecimal.TEN;

    /**
     * Repository for backtest results.
     */
    @Mock
    private BacktestResultRepository resultRepository;

    /**
     * Repository for backtest trades.
     */
    @Mock
    private BacktestTradeRepository backtestTradeRepository;

    /**
     * Repository for strategies.
     */
    @Mock
    private StrategyRepository strategyRepository;

    /**
     * Repository for strategy versions.
     */
    @Mock
    private StrategyVersionRepository versionRepository;

    /**
     * Service for kline data.
     */
    @Mock
    private KlineService klineService;

    /**
     * Mapper for backtest trades.
     */
    @Mock
    private BacktestTradeMapper backtestTradeMapper;

    /**
     * Support for strategy access validation.
     */
    @Mock
    private StrategyAccessSupport strategyAccessSupport;

    /**
     * Instance under test.
     */
    private BacktestServiceImpl backtestService;

    @BeforeEach
    void setUp() {
        backtestService = new BacktestServiceImpl(
                resultRepository,
                backtestTradeRepository,
                strategyRepository,
                versionRepository,
                klineService,
                backtestTradeMapper,
                strategyAccessSupport);
    }

    @Test
    @DisplayName("executeBuy 应使用传入的实际股票代码")
    void executeBuyShouldUseActualSymbol() {
        BacktestExecutionContext context = new BacktestExecutionContext(
                INITIAL_CAPITAL, COMMISSION_RATE, SLIPPAGE);
        KlineDataDto current = KlineDataDto.builder()
                .timestamp(1L)
                .open(TEST_PRICE)
                .high(TEST_PRICE)
                .low(TEST_PRICE)
                .close(TEST_PRICE)
                .volume(TEST_VOLUME)
                .amount(TEST_AMOUNT_BUY)
                .build();

        BacktestTrade trade = (BacktestTrade) ReflectionTestUtils.invokeMethod(
                backtestService,
                "executeBuy",
                context,
                current,
                BACKTEST_RESULT_ID,
                TEST_SYMBOL);

        assertThat(trade).isNotNull();
        assertThat(trade.getSymbol()).isEqualTo(TEST_SYMBOL);
        assertThat(trade.getBacktestResultId()).isEqualTo(BACKTEST_RESULT_ID);
    }

    @Test
    @DisplayName("executeSell 应使用传入的实际股票代码")
    void executeSellShouldUseActualSymbol() {
        BacktestExecutionContext context = new BacktestExecutionContext(
                INITIAL_CAPITAL, COMMISSION_RATE, SLIPPAGE);
        ReflectionTestUtils.setField(context, "position", TEST_POSITION);
        ReflectionTestUtils.setField(context, "entryPrice", TEST_ENTRY_PRICE);

        KlineDataDto current = KlineDataDto.builder()
                .timestamp(2L)
                .open(TEST_SELL_PRICE)
                .high(TEST_SELL_PRICE)
                .low(TEST_SELL_PRICE)
                .close(TEST_SELL_PRICE)
                .volume(TEST_VOLUME)
                .amount(TEST_AMOUNT_SELL)
                .build();

        BacktestTrade trade = (BacktestTrade) ReflectionTestUtils.invokeMethod(
                backtestService,
                "executeSell",
                context,
                current,
                BACKTEST_RESULT_ID,
                TEST_SYMBOL);

        assertThat(trade).isNotNull();
        assertThat(trade.getSymbol()).isEqualTo(TEST_SYMBOL);
        assertThat(trade.getBacktestResultId()).isEqualTo(BACKTEST_RESULT_ID);
    }

    @Test
    @DisplayName("calculateMASeries 滑动窗口计算结果应正确")
    void calculateMASeriesShouldComputeCorrectly() {
        int dataSize = 10;
        int maPeriod = 5;
        long volumeMultiplier = 100L;
        List<KlineDataDto> data = new ArrayList<>();
        for (int i = 1; i <= dataSize; i++) {
            data.add(KlineDataDto.builder()
                    .timestamp((long) i)
                    .open(BigDecimal.valueOf(i))
                    .high(BigDecimal.valueOf(i))
                    .low(BigDecimal.valueOf(i))
                    .close(BigDecimal.valueOf(i))
                    .volume(TEST_VOLUME)
                    .amount(BigDecimal.valueOf(i * volumeMultiplier))
                    .build());
        }

        @SuppressWarnings("unchecked")
        List<BigDecimal> series = (List<BigDecimal>) ReflectionTestUtils.invokeMethod(
                backtestService, "calculateMASeries", data, maPeriod);

        assertThat(series).isNotNull().hasSize(dataSize);
        // Before period: fallback to current close
        for (int i = 0; i < maPeriod - 1; i++) {
            assertThat(series.get(i)).isEqualTo(BigDecimal.valueOf(i + 1));
        }
        // After period: sliding window average
        for (int i = maPeriod - 1; i < dataSize; i++) {
            BigDecimal expectedSum = BigDecimal.ZERO;
            for (int j = i - maPeriod + 1; j <= i; j++) {
                expectedSum = expectedSum.add(BigDecimal.valueOf(j + 1));
            }
            BigDecimal expected = expectedSum.divide(
                    BigDecimal.valueOf(maPeriod), 4, java.math.RoundingMode.HALF_UP);
            assertThat(series.get(i)).isEqualTo(expected);
        }
    }

    @Test
    @DisplayName("generateSignal 应正确识别金叉和死叉")
    void generateSignalShouldDetectCrossoverCorrectly() {
        BacktestSignal buy = (BacktestSignal) ReflectionTestUtils.invokeMethod(
                backtestService,
                "generateSignal",
                new BigDecimal("11"), new BigDecimal("10"),
                new BigDecimal("9"), new BigDecimal("10"));
        assertThat(buy).isEqualTo(BacktestSignal.BUY);

        BacktestSignal sell = (BacktestSignal) ReflectionTestUtils.invokeMethod(
                backtestService,
                "generateSignal",
                new BigDecimal("9"), new BigDecimal("10"),
                new BigDecimal("11"), new BigDecimal("10"));
        assertThat(sell).isEqualTo(BacktestSignal.SELL);

        BacktestSignal hold = (BacktestSignal) ReflectionTestUtils.invokeMethod(
                backtestService,
                "generateSignal",
                new BigDecimal("11"), new BigDecimal("10"),
                new BigDecimal("11"), new BigDecimal("10"));
        assertThat(hold).isEqualTo(BacktestSignal.HOLD);
    }
}
