package com.koduck.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.backtest.BacktestResultDto;
import com.koduck.dto.backtest.BacktestTradeDto;
import com.koduck.dto.backtest.RunBacktestRequest;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.BacktestResult;
import com.koduck.entity.BacktestTrade;
import com.koduck.entity.Strategy;
import com.koduck.entity.StrategyVersion;
import com.koduck.entity.enums.TradeType;
import com.koduck.exception.BusinessException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.mapper.BacktestTradeMapper;
import com.koduck.repository.BacktestResultRepository;
import com.koduck.repository.BacktestTradeRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.repository.StrategyVersionRepository;
import com.koduck.service.BacktestService;
import com.koduck.service.KlineService;
import com.koduck.service.support.BacktestExecutionContext;
import com.koduck.service.support.BacktestSignal;
import com.koduck.service.support.StrategyAccessSupport;
import com.koduck.util.ServiceValidationUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Implementation of BacktestService.
 *
 * @author Koduck Team
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class BacktestServiceImpl implements BacktestService {

    /** The result repository. */
    private final BacktestResultRepository resultRepository;
    /** The backtest trade repository. */
    private final BacktestTradeRepository backtestTradeRepository;
    /** The strategy repository. */
    private final StrategyRepository strategyRepository;
    /** The version repository. */
    private final StrategyVersionRepository versionRepository;
    /** The kline service. */
    private final KlineService klineService;
    /** The backtest trade mapper. */
    private final BacktestTradeMapper backtestTradeMapper;
    /** The strategy access support. */
    private final StrategyAccessSupport strategyAccessSupport;

    /** The decimal scale. */
    private static final int SCALE = 4;
    /** The default timeframe. */
    private static final String DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME;
    /** The kline data limit. */
    private static final int KLINE_DATA_LIMIT = 1000;
    /** The seconds per day. */
    private static final long SECONDS_PER_DAY = 86400L;
    /** The minimum bars required. */
    private static final int MINIMUM_BARS = 60;
    /** The MA short period. */
    private static final int MA_SHORT_PERIOD = 20;
    /** The percentage multiplier. */
    private static final int PERCENTAGE_MULTIPLIER = 100;
    /** The days per year. */
    private static final double DAYS_PER_YEAR = 365.0;
    /** The trading days per year. */
    private static final int TRADING_DAYS_PER_YEAR = 252;
    /** The cash usage ratio. */
    private static final BigDecimal CASH_USAGE_RATIO = new BigDecimal("0.9");
    /** The buy signal reason. */
    private static final String BUY_SIGNAL_REASON = "MA20 crosses above MA60";
    /** The sell signal reason. */
    private static final String SELL_SIGNAL_REASON = "MA20 crosses below MA60";

    /**
     * Get all backtest results for a user.
     */
    @Override
    public List<BacktestResultDto> getBacktestResults(Long userId) {
        log.debug("Getting backtest results for user: {}", userId);
        List<BacktestResult> results = resultRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return results.stream()
            .map(this::convertToDto)
            .toList();
    }

    /**
     * Get a backtest result by id.
     */
    @Override
    public BacktestResultDto getBacktestResult(Long userId, Long id) {
        log.debug("Getting backtest result: user={}, id={}", userId, id);
        BacktestResult result = loadBacktestResultOrThrow(userId, id);
        return convertToDto(result);
    }

    /**
     * Run a backtest.
     */
    @Override
    @Transactional
    public BacktestResultDto runBacktest(Long userId, RunBacktestRequest request) {
        log.info("Running backtest: user={}, strategyId={}, symbol={}", userId, request.strategyId(), request.symbol());
        // Get strategy
        Strategy strategy = strategyAccessSupport.loadStrategyOrThrow(userId, request.strategyId());
        // Get active version
        StrategyVersion version = versionRepository.findByStrategyIdAndIsActiveTrue(strategy.getId())
            .orElseGet(() -> loadLatestVersionOrThrow(strategy.getId()));
        // Create backtest result record
        BacktestResult result = BacktestResult.builder()
            .userId(userId)
            .strategyId(request.strategyId())
            .strategyVersion(version.getVersionNumber())
            .market(request.market())
            .symbol(request.symbol())
            .startDate(request.startDate())
            .endDate(request.endDate())
            .timeframe(request.timeframe() != null ? request.timeframe() : DEFAULT_TIMEFRAME)
            .initialCapital(request.initialCapital())
            .commissionRate(request.commissionRate() != null ? request.commissionRate() : new BigDecimal("0.001"))
            .slippage(request.slippage() != null ? request.slippage() : new BigDecimal("0.001"))
            .status(BacktestResult.BacktestStatus.RUNNING)
            .build();
        BacktestResult savedResult = resultRepository.save(Objects.requireNonNull(result, "result must not be null"));
        try {
            // Execute backtest
            executeBacktest(savedResult);
            // Update status
            savedResult.setStatus(BacktestResult.BacktestStatus.COMPLETED);
            savedResult.setCompletedAt(LocalDateTime.now());
            resultRepository.save(savedResult);
            log.info("Backtest completed: id={}, user={}", savedResult.getId(), userId);
        }
        catch (Exception e) {
            log.error("Backtest failed: id={}, error={}", savedResult.getId(), e.getMessage(), e);
            savedResult.setStatus(BacktestResult.BacktestStatus.FAILED);
            savedResult.setErrorMessage(e.getMessage());
            savedResult.setCompletedAt(LocalDateTime.now());
            resultRepository.save(savedResult);
        }
        return convertToDto(savedResult);
    }

    /**
     * Get trades for a backtest result.
     */
    @Override
    public List<BacktestTradeDto> getBacktestTrades(Long userId, Long backtestId) {
        log.debug("Getting backtest trades: user={}, backtestId={}", userId, backtestId);
        loadBacktestResultOrThrow(userId, backtestId);
        List<BacktestTrade> trades = backtestTradeRepository.findByBacktestResultIdOrderByTradeTimeAsc(backtestId);
        return trades.stream()
            .map(this::convertTradeToDto)
            .toList();
    }

    /**
     * Delete a backtest result.
     */
    @Override
    @Transactional
    public void deleteBacktestResult(Long userId, Long id) {
        log.debug("Deleting backtest result: user={}, id={}", userId, id);
        BacktestResult result = loadBacktestResultOrThrow(userId, id);
        // Delete trades first
        backtestTradeRepository.deleteByBacktestResultId(id);
        // Delete result
        resultRepository.delete(Objects.requireNonNull(result, "result must not be null"));
        log.info("Deleted backtest result: user={}, id={}", userId, id);
    }

    /**
     * Execute backtest logic.
     */
    private void executeBacktest(BacktestResult result) {
        // Get historical data
        String timeframe = result.getTimeframe() != null ? result.getTimeframe() : DEFAULT_TIMEFRAME;
        List<KlineDataDto> klineData = klineService.getKlineData(
            result.getMarket(), result.getSymbol(), timeframe, KLINE_DATA_LIMIT, null);
        if (klineData.isEmpty()) {
            throw new BusinessException(ErrorCode.BACKTEST_INSUFFICIENT_DATA, "No historical data available");
        }
        // Filter by date range
        List<KlineDataDto> filteredData = klineData.stream()
            .filter(k -> {
                LocalDate date = LocalDate.ofEpochDay(k.timestamp() / SECONDS_PER_DAY);
                return !date.isBefore(result.getStartDate()) && !date.isAfter(result.getEndDate());
            })
            .sorted((a, b) -> Long.compare(a.timestamp(), b.timestamp()))
            .toList();
        if (filteredData.size() < MINIMUM_BARS) {
            throw new BusinessException(
                    ErrorCode.BACKTEST_INSUFFICIENT_DATA,
                    "Insufficient data for backtest (need at least " + MINIMUM_BARS + " bars)");
        }
        // Initialize backtest state
        BacktestExecutionContext context = new BacktestExecutionContext(
            result.getInitialCapital(),
            result.getCommissionRate(),
            result.getSlippage()
        );
        List<BacktestTrade> trades = new ArrayList<>();
        List<BigDecimal> equityCurve = new ArrayList<>();
        // Run backtest simulation
        for (int i = MINIMUM_BARS; i < filteredData.size(); i++) {
            List<KlineDataDto> history = filteredData.subList(0, i + 1);
            KlineDataDto current = filteredData.get(i);
            // Simple MA crossover strategy
            BacktestSignal signal = generateSignal(history);
            if (signal == BacktestSignal.BUY && context.getPosition().compareTo(BigDecimal.ZERO) == 0) {
                // Execute buy
                BacktestTrade trade = executeBuy(context, current, result.getId());
                if (trade != null) {
                    trades.add(trade);
                }
            }
            else if (signal == BacktestSignal.SELL && context.getPosition().compareTo(BigDecimal.ZERO) > 0) {
                // Execute sell
                BacktestTrade trade = executeSell(context, current, result.getId());
                trades.add(trade);
            }
            // Record equity
            BigDecimal currentEquity = context.getCash().add(context.getPosition().multiply(current.close()));
            equityCurve.add(currentEquity);
        }
        // Calculate final metrics
        calculateMetrics(result, context, trades, equityCurve, filteredData);
        // Save trades
        if (!trades.isEmpty()) {
            backtestTradeRepository.saveAll(trades);
        }
    }

    /**
     * Generate trading signal based on MA crossover.
     */
    private BacktestSignal generateSignal(List<KlineDataDto> history) {
        if (history.size() < MINIMUM_BARS) {
            return BacktestSignal.HOLD;
        }
        // Calculate MA20 and MA60
        BigDecimal ma20 = calculateMA(history, MA_SHORT_PERIOD);
        BigDecimal ma60 = calculateMA(history, MINIMUM_BARS);
        // Calculate previous MA
        List<KlineDataDto> prevHistory = history.subList(0, history.size() - 1);
        BigDecimal prevMa20 = calculateMA(prevHistory, MA_SHORT_PERIOD);
        BigDecimal prevMa60 = calculateMA(prevHistory, MINIMUM_BARS);
        // Golden cross: MA20 crosses above MA60
        if (ma20.compareTo(ma60) > 0 && prevMa20.compareTo(prevMa60) <= 0) {
            return BacktestSignal.BUY;
        }
        // Death cross: MA20 crosses below MA60
        if (ma20.compareTo(ma60) < 0 && prevMa20.compareTo(prevMa60) >= 0) {
            return BacktestSignal.SELL;
        }
        return BacktestSignal.HOLD;
    }

    /**
     * Calculate Moving Average.
     */
    private BigDecimal calculateMA(List<KlineDataDto> data, int period) {
        if (data.size() < period) {
            return data.get(data.size() - 1).close();
        }
        List<KlineDataDto> subList = data.subList(data.size() - period, data.size());
        BigDecimal sum = BigDecimal.ZERO;
        for (KlineDataDto k : subList) {
            sum = sum.add(k.close());
        }
        return sum.divide(BigDecimal.valueOf(period), SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Execute buy order.
     */
    private BacktestTrade executeBuy(BacktestExecutionContext context, KlineDataDto current,
                                     Long backtestResultId) {
        BigDecimal price = current.close().multiply(
            BigDecimal.ONE.add(context.getSlippage())).setScale(SCALE, RoundingMode.HALF_UP);
        // Use 90% of cash for position
        BigDecimal positionValue = context.getCash().multiply(CASH_USAGE_RATIO);
        BigDecimal quantity = positionValue.divide(price, 0, RoundingMode.DOWN);
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        BigDecimal amount = price.multiply(quantity);
        BigDecimal commission = amount.multiply(context.getCommissionRate()).setScale(SCALE, RoundingMode.HALF_UP);
        BigDecimal totalCost = amount.add(commission);
        context.setCash(context.getCash().subtract(totalCost));
        context.setPosition(context.getPosition().add(quantity));
        context.setEntryPrice(price);
        return BacktestTrade.builder()
            .backtestResultId(backtestResultId)
            .tradeType(TradeType.BUY)
            .tradeTime(LocalDateTime.ofEpochSecond(current.timestamp(), 0, java.time.ZoneOffset.UTC))
            .symbol("SYMBOL")
            .price(price)
            .quantity(quantity)
            .amount(amount)
            .commission(commission)
            .slippageCost(amount.multiply(context.getSlippage()).setScale(SCALE, RoundingMode.HALF_UP))
            .totalCost(totalCost)
            .cashAfter(context.getCash())
            .positionAfter(context.getPosition())
            .signalReason(BUY_SIGNAL_REASON)
            .build();
    }

    /**
     * Execute sell order.
     */
    private BacktestTrade executeSell(BacktestExecutionContext context, KlineDataDto current,
                                      Long backtestResultId) {
        BigDecimal price = current.close().multiply(
            BigDecimal.ONE.subtract(context.getSlippage())).setScale(SCALE, RoundingMode.HALF_UP);
        BigDecimal quantity = context.getPosition();
        BigDecimal amount = price.multiply(quantity);
        BigDecimal commission = amount.multiply(context.getCommissionRate()).setScale(SCALE, RoundingMode.HALF_UP);
        BigDecimal totalCost = amount.subtract(commission);
        // Calculate PnL
        BigDecimal pnl = totalCost.subtract(context.getEntryPrice().multiply(quantity));
        BigDecimal pnlPercent = context.getEntryPrice().compareTo(BigDecimal.ZERO) > 0
            ? pnl.divide(context.getEntryPrice().multiply(quantity), SCALE, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
            : BigDecimal.ZERO;
        context.setCash(context.getCash().add(totalCost));
        context.setPosition(BigDecimal.ZERO);
        return BacktestTrade.builder()
            .backtestResultId(backtestResultId)
            .tradeType(TradeType.SELL)
            .tradeTime(LocalDateTime.ofEpochSecond(current.timestamp(), 0, java.time.ZoneOffset.UTC))
            .symbol("SYMBOL")
            .price(price)
            .quantity(quantity)
            .amount(amount)
            .commission(commission)
            .slippageCost(amount.multiply(context.getSlippage()).setScale(SCALE, RoundingMode.HALF_UP))
            .totalCost(totalCost)
            .cashAfter(context.getCash())
            .positionAfter(context.getPosition())
            .pnl(pnl)
            .pnlPercent(pnlPercent)
            .signalReason(SELL_SIGNAL_REASON)
            .build();
    }

    /**
     * Calculate backtest metrics.
     */
    private void calculateMetrics(BacktestResult result, BacktestExecutionContext context,
                                  List<BacktestTrade> trades, List<BigDecimal> equityCurve,
                                  List<KlineDataDto> data) {
        // Final capital
        BigDecimal finalPrice = data.get(data.size() - 1).close();
        BigDecimal finalCapital = context.getCash().add(context.getPosition().multiply(finalPrice));
        result.setFinalCapital(finalCapital);
        // Total return
        BigDecimal totalReturn = finalCapital.subtract(result.getInitialCapital())
            .divide(result.getInitialCapital(), SCALE, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER));
        result.setTotalReturn(totalReturn);
        // Annualized return
        long days = ChronoUnit.DAYS.between(result.getStartDate(), result.getEndDate());
        double years = days / DAYS_PER_YEAR;
        if (years > 0) {
            double totalReturnFactor = finalCapital.doubleValue() / result.getInitialCapital().doubleValue();
            double annualizedReturn = (Math.pow(totalReturnFactor, 1.0 / years) - 1) * PERCENTAGE_MULTIPLIER;
            result.setAnnualizedReturn(BigDecimal.valueOf(annualizedReturn).setScale(SCALE, RoundingMode.HALF_UP));
        }
        // Max drawdown
        BigDecimal maxDrawdown = calculateMaxDrawdown(equityCurve);
        result.setMaxDrawdown(maxDrawdown);
        // Trade statistics
        List<BacktestTrade> sellTrades = trades.stream()
            .filter(t -> t.getTradeType() == TradeType.SELL)
            .toList();
        int totalTrades = sellTrades.size();
        int winningTrades = (int) sellTrades.stream()
            .filter(t -> t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) > 0)
            .count();
        int losingTrades = totalTrades - winningTrades;
        result.setTotalTrades(totalTrades);
        result.setWinningTrades(winningTrades);
        result.setLosingTrades(losingTrades);
        if (totalTrades > 0) {
            BigDecimal winRate = BigDecimal.valueOf(winningTrades)
                .divide(BigDecimal.valueOf(totalTrades), SCALE, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER));
            result.setWinRate(winRate);
        }
        // Average profit/loss
        BigDecimal avgProfit = sellTrades.stream()
            .filter(t -> t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) > 0)
            .map(BacktestTrade::getPnl)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (winningTrades > 0) {
            avgProfit = avgProfit.divide(BigDecimal.valueOf(winningTrades), SCALE, RoundingMode.HALF_UP);
        }
        result.setAvgProfit(avgProfit);
        BigDecimal avgLoss = sellTrades.stream()
            .filter(t -> t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) < 0)
            .map(BacktestTrade::getPnl)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (losingTrades > 0) {
            avgLoss = avgLoss.divide(BigDecimal.valueOf(losingTrades), SCALE, RoundingMode.HALF_UP);
        }
        result.setAvgLoss(avgLoss);
        // Profit factor
        BigDecimal grossProfit = sellTrades.stream()
            .filter(t -> t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) > 0)
            .map(BacktestTrade::getPnl)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossLoss = sellTrades.stream()
            .filter(t -> t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) < 0)
            .map(BacktestTrade::getPnl)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .abs();
        if (grossLoss.compareTo(BigDecimal.ZERO) > 0) {
            result.setProfitFactor(grossProfit.divide(grossLoss, SCALE, RoundingMode.HALF_UP));
        }
        else {
            result.setProfitFactor(BigDecimal.ZERO);
        }
        // Sharpe ratio (simplified)
        if (equityCurve.size() > 1) {
            BigDecimal sharpeRatio = calculateSharpeRatio(equityCurve);
            result.setSharpeRatio(sharpeRatio);
        }
    }

    /**
     * Calculate maximum drawdown.
     */
    private BigDecimal calculateMaxDrawdown(List<BigDecimal> equityCurve) {
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        BigDecimal peak = equityCurve.get(0);
        for (BigDecimal equity : equityCurve) {
            if (equity.compareTo(peak) > 0) {
                peak = equity;
            }
            BigDecimal drawdown = peak.subtract(equity)
                .divide(peak, SCALE, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER));
            if (drawdown.compareTo(maxDrawdown) > 0) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    /**
     * Calculate Sharpe ratio (simplified).
     */
    private BigDecimal calculateSharpeRatio(List<BigDecimal> equityCurve) {
        List<BigDecimal> returns = new ArrayList<>();
        for (int i = 1; i < equityCurve.size(); i++) {
            BigDecimal dailyReturn = equityCurve.get(i).subtract(equityCurve.get(i - 1))
                .divide(equityCurve.get(i - 1), SCALE, RoundingMode.HALF_UP);
            returns.add(dailyReturn);
        }
        if (returns.isEmpty()) {
            return BigDecimal.ZERO;
        }
        // Mean return
        BigDecimal meanReturn = returns.stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(returns.size()), SCALE, RoundingMode.HALF_UP);
        // Standard deviation
        BigDecimal variance = returns.stream()
            .map(r -> r.subtract(meanReturn).pow(2))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(returns.size()), SCALE, RoundingMode.HALF_UP);
        BigDecimal stdDev = BigDecimal.valueOf(Math.sqrt(variance.doubleValue()));
        if (stdDev.compareTo(BigDecimal.ZERO) > 0) {
            // Annualized Sharpe ratio (assuming TRADING_DAYS_PER_YEAR trading days)
            return meanReturn.multiply(BigDecimal.valueOf(TRADING_DAYS_PER_YEAR))
                .divide(stdDev.multiply(BigDecimal.valueOf(Math.sqrt(TRADING_DAYS_PER_YEAR))),
                    SCALE, RoundingMode.HALF_UP);
        }
        return BigDecimal.ZERO;
    }

    private BacktestResult loadBacktestResultOrThrow(Long userId, Long backtestId) {
        return ServiceValidationUtils.requireFound(resultRepository.findByIdAndUserId(backtestId, userId),
                () -> new ResourceNotFoundException("backtest result", backtestId));
    }

    private StrategyVersion loadLatestVersionOrThrow(Long strategyId) {
        return ServiceValidationUtils.requireFound(
                versionRepository.findFirstByStrategyIdOrderByVersionNumberDesc(strategyId),
                () -> new ResourceNotFoundException("strategy version for strategy", strategyId));
    }

    /**
     * Convert BacktestResult to DTO.
     */
    private BacktestResultDto convertToDto(BacktestResult result) {
        // Get strategy name
        String strategyName = strategyRepository.findById(
            Objects.requireNonNull(result.getStrategyId(), "strategyId must not be null"))
            .map(Strategy::getName)
            .orElse("Unknown");
        return BacktestResultDto.builder()
            .id(result.getId())
            .strategyId(result.getStrategyId())
            .strategyName(strategyName)
            .strategyVersion(result.getStrategyVersion())
            .market(result.getMarket())
            .symbol(result.getSymbol())
            .startDate(result.getStartDate())
            .endDate(result.getEndDate())
            .timeframe(result.getTimeframe())
            .initialCapital(result.getInitialCapital())
            .commissionRate(result.getCommissionRate())
            .slippage(result.getSlippage())
            .finalCapital(result.getFinalCapital())
            .totalReturn(result.getTotalReturn())
            .annualizedReturn(result.getAnnualizedReturn())
            .maxDrawdown(result.getMaxDrawdown())
            .sharpeRatio(result.getSharpeRatio())
            .totalTrades(result.getTotalTrades())
            .winningTrades(result.getWinningTrades())
            .losingTrades(result.getLosingTrades())
            .winRate(result.getWinRate())
            .avgProfit(result.getAvgProfit())
            .avgLoss(result.getAvgLoss())
            .profitFactor(result.getProfitFactor())
            .status(result.getStatus().name())
            .errorMessage(result.getErrorMessage())
            .createdAt(result.getCreatedAt())
            .completedAt(result.getCompletedAt())
            .build();
    }

    /**
     * Convert BacktestTrade to DTO.
     */
    private BacktestTradeDto convertTradeToDto(BacktestTrade trade) {
        return backtestTradeMapper.toDto(trade);
    }
}
