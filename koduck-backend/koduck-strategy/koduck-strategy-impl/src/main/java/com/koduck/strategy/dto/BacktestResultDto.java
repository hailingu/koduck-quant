package com.koduck.strategy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 回测结果数据传输对象。
 *
 * @param id ID
 * @param strategyId Strategy ID
 * @param strategyName Strategy name
 * @param strategyVersion Strategy version
 * @param market Market
 * @param symbol Symbol
 * @param startDate Start date
 * @param endDate End date
 * @param timeframe Timeframe
 * @param initialCapital Initial capital
 * @param commissionRate Commission rate
 * @param slippage Slippage
 * @param finalCapital Final capital
 * @param totalReturn Total return
 * @param annualizedReturn Annualized return
 * @param maxDrawdown Max drawdown
 * @param sharpeRatio Sharpe ratio
 * @param totalTrades Total trades
 * @param winningTrades Winning trades
 * @param losingTrades Losing trades
 * @param winRate Win rate
 * @param avgProfit Average profit
 * @param avgLoss Average loss
 * @param profitFactor Profit factor
 * @param status Status
 * @param errorMessage Error message
 * @param createdAt Created at
 * @param completedAt Completed at
 * @author Koduck Team
 */
public record BacktestResultDto(
    Long id,
    Long strategyId,
    String strategyName,
    Integer strategyVersion,
    String market,
    String symbol,
    LocalDate startDate,
    LocalDate endDate,
    String timeframe,
    BigDecimal initialCapital,
    BigDecimal commissionRate,
    BigDecimal slippage,
    BigDecimal finalCapital,
    BigDecimal totalReturn,
    BigDecimal annualizedReturn,
    BigDecimal maxDrawdown,
    BigDecimal sharpeRatio,
    Integer totalTrades,
    Integer winningTrades,
    Integer losingTrades,
    BigDecimal winRate,
    BigDecimal avgProfit,
    BigDecimal avgLoss,
    BigDecimal profitFactor,
    String status,
    String errorMessage,
    LocalDateTime createdAt,
    LocalDateTime completedAt
) {

    /**
     * Create a new builder.
     *
     * @return Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * BacktestResultDto 的构建器。
     */
    public static class Builder {
        /** ID。 */
        private Long id;
        /** 策略ID。 */
        private Long strategyId;
        /** 策略名称。 */
        private String strategyName;
        /** 策略版本。 */
        private Integer strategyVersion;
        /** 市场。 */
        private String market;
        /** 品种代码。 */
        private String symbol;
        /** 开始日期。 */
        private LocalDate startDate;
        /** 结束日期。 */
        private LocalDate endDate;
        /** 时间周期。 */
        private String timeframe;
        /** 初始资金。 */
        private BigDecimal initialCapital;
        /** 佣金费率。 */
        private BigDecimal commissionRate;
        /** 滑点。 */
        private BigDecimal slippage;
        /** 最终资金。 */
        private BigDecimal finalCapital;
        /** 总收益。 */
        private BigDecimal totalReturn;
        /** 年化收益。 */
        private BigDecimal annualizedReturn;
        /** 最大回撤。 */
        private BigDecimal maxDrawdown;
        /** 夏普比率。 */
        private BigDecimal sharpeRatio;
        /** 总交易次数。 */
        private Integer totalTrades;
        /** 盈利交易次数。 */
        private Integer winningTrades;
        /** 亏损交易次数。 */
        private Integer losingTrades;
        /** 胜率。 */
        private BigDecimal winRate;
        /** 平均盈利。 */
        private BigDecimal avgProfit;
        /** 平均亏损。 */
        private BigDecimal avgLoss;
        /** 盈利因子。 */
        private BigDecimal profitFactor;
        /** 状态。 */
        private String status;
        /** 错误消息。 */
        private String errorMessage;
        /** 创建时间。 */
        private LocalDateTime createdAt;
        /** 完成时间。 */
        private LocalDateTime completedAt;

        /**
 * 设置ID。
         *
         * @param id ID
         * @return Builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
 * 设置策略ID。
         *
         * @param strategyId Strategy ID
         * @return Builder
         */
        public Builder strategyId(Long strategyId) {
            this.strategyId = strategyId;
            return this;
        }

        /**
 * 设置策略名称。
         *
         * @param strategyName Strategy name
         * @return Builder
         */
        public Builder strategyName(String strategyName) {
            this.strategyName = strategyName;
            return this;
        }

        /**
 * 设置策略版本。
         *
         * @param strategyVersion Strategy version
         * @return Builder
         */
        public Builder strategyVersion(Integer strategyVersion) {
            this.strategyVersion = strategyVersion;
            return this;
        }

        /**
 * 设置市场。
         *
         * @param market Market
         * @return Builder
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
 * 设置品种代码。
         *
         * @param symbol Symbol
         * @return Builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
 * 设置开始日期。
         *
         * @param startDate Start date
         * @return Builder
         */
        public Builder startDate(LocalDate startDate) {
            this.startDate = startDate;
            return this;
        }

        /**
 * 设置结束日期。
         *
         * @param endDate End date
         * @return Builder
         */
        public Builder endDate(LocalDate endDate) {
            this.endDate = endDate;
            return this;
        }

        /**
 * 设置时间周期。
         *
         * @param timeframe Timeframe
         * @return Builder
         */
        public Builder timeframe(String timeframe) {
            this.timeframe = timeframe;
            return this;
        }

        /**
 * 设置初始资金。
         *
         * @param initialCapital Initial capital
         * @return Builder
         */
        public Builder initialCapital(BigDecimal initialCapital) {
            this.initialCapital = initialCapital;
            return this;
        }

        /**
 * 设置佣金费率。
         *
         * @param commissionRate Commission rate
         * @return Builder
         */
        public Builder commissionRate(BigDecimal commissionRate) {
            this.commissionRate = commissionRate;
            return this;
        }

        /**
 * 设置滑点。
         *
         * @param slippage Slippage
         * @return Builder
         */
        public Builder slippage(BigDecimal slippage) {
            this.slippage = slippage;
            return this;
        }

        /**
 * 设置最终资金。
         *
         * @param finalCapital Final capital
         * @return Builder
         */
        public Builder finalCapital(BigDecimal finalCapital) {
            this.finalCapital = finalCapital;
            return this;
        }

        /**
 * 设置总收益。
         *
         * @param totalReturn Total return
         * @return Builder
         */
        public Builder totalReturn(BigDecimal totalReturn) {
            this.totalReturn = totalReturn;
            return this;
        }

        /**
 * 设置年化收益。
         *
         * @param annualizedReturn Annualized return
         * @return Builder
         */
        public Builder annualizedReturn(BigDecimal annualizedReturn) {
            this.annualizedReturn = annualizedReturn;
            return this;
        }

        /**
 * 设置最大回撤。
         *
         * @param maxDrawdown Max drawdown
         * @return Builder
         */
        public Builder maxDrawdown(BigDecimal maxDrawdown) {
            this.maxDrawdown = maxDrawdown;
            return this;
        }

        /**
 * 设置夏普比率。
         *
         * @param sharpeRatio Sharpe ratio
         * @return Builder
         */
        public Builder sharpeRatio(BigDecimal sharpeRatio) {
            this.sharpeRatio = sharpeRatio;
            return this;
        }

        /**
 * 设置总交易次数。
         *
         * @param totalTrades Total trades
         * @return Builder
         */
        public Builder totalTrades(Integer totalTrades) {
            this.totalTrades = totalTrades;
            return this;
        }

        /**
 * 设置盈利交易次数。
         *
         * @param winningTrades Winning trades
         * @return Builder
         */
        public Builder winningTrades(Integer winningTrades) {
            this.winningTrades = winningTrades;
            return this;
        }

        /**
 * 设置亏损交易次数。
         *
         * @param losingTrades Losing trades
         * @return Builder
         */
        public Builder losingTrades(Integer losingTrades) {
            this.losingTrades = losingTrades;
            return this;
        }

        /**
 * 设置胜率。
         *
         * @param winRate Win rate
         * @return Builder
         */
        public Builder winRate(BigDecimal winRate) {
            this.winRate = winRate;
            return this;
        }

        /**
 * 设置平均盈利。
         *
         * @param avgProfit Average profit
         * @return Builder
         */
        public Builder avgProfit(BigDecimal avgProfit) {
            this.avgProfit = avgProfit;
            return this;
        }

        /**
 * 设置平均亏损。
         *
         * @param avgLoss Average loss
         * @return Builder
         */
        public Builder avgLoss(BigDecimal avgLoss) {
            this.avgLoss = avgLoss;
            return this;
        }

        /**
 * 设置盈利因子。
         *
         * @param profitFactor Profit factor
         * @return Builder
         */
        public Builder profitFactor(BigDecimal profitFactor) {
            this.profitFactor = profitFactor;
            return this;
        }

        /**
 * 设置状态。
         *
         * @param status Status
         * @return Builder
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
 * 设置错误消息。
         *
         * @param errorMessage Error message
         * @return Builder
         */
        public Builder errorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            return this;
        }

        /**
 * 设置创建时间。
         *
         * @param createdAt Created at
         * @return Builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
 * 设置完成时间。
         *
         * @param completedAt Completed at
         * @return Builder
         */
        public Builder completedAt(LocalDateTime completedAt) {
            this.completedAt = completedAt;
            return this;
        }

        /**
 * 构建 BacktestResultDto。
         *
         * @return BacktestResultDto instance
         */
        public BacktestResultDto build() {
            return new BacktestResultDto(
                id,
                strategyId,
                strategyName,
                strategyVersion,
                market,
                symbol,
                startDate,
                endDate,
                timeframe,
                initialCapital,
                commissionRate,
                slippage,
                finalCapital,
                totalReturn,
                annualizedReturn,
                maxDrawdown,
                sharpeRatio,
                totalTrades,
                winningTrades,
                losingTrades,
                winRate,
                avgProfit,
                avgLoss,
                profitFactor,
                status,
                errorMessage,
                createdAt,
                completedAt
            );
        }
    }
}
