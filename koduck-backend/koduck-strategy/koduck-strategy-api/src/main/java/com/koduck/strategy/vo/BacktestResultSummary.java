package com.koduck.strategy.vo;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 回测结果摘要值对象。
 *
 * <p>供其他领域模块（如 AI）使用，包含回测的核心指标。</p>
 *
 * @param backtestId 回测ID
 * @param strategyId 策略ID
 * @param strategyName 策略名称
 * @param symbol 股票代码
 * @param market 市场
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @param initialCapital 初始资金
 * @param finalCapital 最终资金
 * @param totalReturn 总收益率
 * @param annualizedReturn 年化收益率
 * @param maxDrawdown 最大回撤
 * @param sharpeRatio 夏普比率
 * @param totalTrades 总交易次数
 * @param winRate 胜率
 * @param status 回测状态
 * @param createdAt 创建时间
 */
public record BacktestResultSummary(
        Long backtestId,
        Long strategyId,
        String strategyName,
        String symbol,
        String market,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal initialCapital,
        BigDecimal finalCapital,
        BigDecimal totalReturn,
        BigDecimal annualizedReturn,
        BigDecimal maxDrawdown,
        BigDecimal sharpeRatio,
        Integer totalTrades,
        BigDecimal winRate,
        String status,
        Instant createdAt
) implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 回测状态常量。
     */
    public static class Status {
        public static final String PENDING = "PENDING";
        public static final String RUNNING = "RUNNING";
        public static final String COMPLETED = "COMPLETED";
        public static final String FAILED = "FAILED";
        public static final String CANCELLED = "CANCELLED";
    }
}
