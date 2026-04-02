package com.koduck.dto.backtest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Backtest result DTO.
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
     * Builder for BacktestResultDto.
     */
    public static class Builder {
        /** ID. */
        private Long id;
        /** Strategy ID. */
        private Long strategyId;
        /** Strategy name. */
        private String strategyName;
        /** Strategy version. */
        private Integer strategyVersion;
        /** Market. */
        private String market;
        /** Symbol. */
        private String symbol;
        /** Start date. */
        private LocalDate startDate;
        /** End date. */
        private LocalDate endDate;
        /** Timeframe. */
        private String timeframe;
        /** Initial capital. */
        private BigDecimal initialCapital;
        /** Commission rate. */
        private BigDecimal commissionRate;
        /** Slippage. */
        private BigDecimal slippage;
        /** Final capital. */
        private BigDecimal finalCapital;
        /** Total return. */
        private BigDecimal totalReturn;
        /** Annualized return. */
        private BigDecimal annualizedReturn;
        /** Max drawdown. */
        private BigDecimal maxDrawdown;
        /** Sharpe ratio. */
        private BigDecimal sharpeRatio;
        /** Total trades. */
        private Integer totalTrades;
        /** Winning trades. */
        private Integer winningTrades;
        /** Losing trades. */
        private Integer losingTrades;
        /** Win rate. */
        private BigDecimal winRate;
        /** Average profit. */
        private BigDecimal avgProfit;
        /** Average loss. */
        private BigDecimal avgLoss;
        /** Profit factor. */
        private BigDecimal profitFactor;
        /** Status. */
        private String status;
        /** Error message. */
        private String errorMessage;
        /** Created at. */
        private LocalDateTime createdAt;
        /** Completed at. */
        private LocalDateTime completedAt;

        /**
         * Set ID.
         *
         * @param id ID
         * @return Builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Set strategy ID.
         *
         * @param strategyId Strategy ID
         * @return Builder
         */
        public Builder strategyId(Long strategyId) {
            this.strategyId = strategyId;
            return this;
        }

        /**
         * Set strategy name.
         *
         * @param strategyName Strategy name
         * @return Builder
         */
        public Builder strategyName(String strategyName) {
            this.strategyName = strategyName;
            return this;
        }

        /**
         * Set strategy version.
         *
         * @param strategyVersion Strategy version
         * @return Builder
         */
        public Builder strategyVersion(Integer strategyVersion) {
            this.strategyVersion = strategyVersion;
            return this;
        }

        /**
         * Set market.
         *
         * @param market Market
         * @return Builder
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Set symbol.
         *
         * @param symbol Symbol
         * @return Builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Set start date.
         *
         * @param startDate Start date
         * @return Builder
         */
        public Builder startDate(LocalDate startDate) {
            this.startDate = startDate;
            return this;
        }

        /**
         * Set end date.
         *
         * @param endDate End date
         * @return Builder
         */
        public Builder endDate(LocalDate endDate) {
            this.endDate = endDate;
            return this;
        }

        /**
         * Set timeframe.
         *
         * @param timeframe Timeframe
         * @return Builder
         */
        public Builder timeframe(String timeframe) {
            this.timeframe = timeframe;
            return this;
        }

        /**
         * Set initial capital.
         *
         * @param initialCapital Initial capital
         * @return Builder
         */
        public Builder initialCapital(BigDecimal initialCapital) {
            this.initialCapital = initialCapital;
            return this;
        }

        /**
         * Set commission rate.
         *
         * @param commissionRate Commission rate
         * @return Builder
         */
        public Builder commissionRate(BigDecimal commissionRate) {
            this.commissionRate = commissionRate;
            return this;
        }

        /**
         * Set slippage.
         *
         * @param slippage Slippage
         * @return Builder
         */
        public Builder slippage(BigDecimal slippage) {
            this.slippage = slippage;
            return this;
        }

        /**
         * Set final capital.
         *
         * @param finalCapital Final capital
         * @return Builder
         */
        public Builder finalCapital(BigDecimal finalCapital) {
            this.finalCapital = finalCapital;
            return this;
        }

        /**
         * Set total return.
         *
         * @param totalReturn Total return
         * @return Builder
         */
        public Builder totalReturn(BigDecimal totalReturn) {
            this.totalReturn = totalReturn;
            return this;
        }

        /**
         * Set annualized return.
         *
         * @param annualizedReturn Annualized return
         * @return Builder
         */
        public Builder annualizedReturn(BigDecimal annualizedReturn) {
            this.annualizedReturn = annualizedReturn;
            return this;
        }

        /**
         * Set max drawdown.
         *
         * @param maxDrawdown Max drawdown
         * @return Builder
         */
        public Builder maxDrawdown(BigDecimal maxDrawdown) {
            this.maxDrawdown = maxDrawdown;
            return this;
        }

        /**
         * Set sharpe ratio.
         *
         * @param sharpeRatio Sharpe ratio
         * @return Builder
         */
        public Builder sharpeRatio(BigDecimal sharpeRatio) {
            this.sharpeRatio = sharpeRatio;
            return this;
        }

        /**
         * Set total trades.
         *
         * @param totalTrades Total trades
         * @return Builder
         */
        public Builder totalTrades(Integer totalTrades) {
            this.totalTrades = totalTrades;
            return this;
        }

        /**
         * Set winning trades.
         *
         * @param winningTrades Winning trades
         * @return Builder
         */
        public Builder winningTrades(Integer winningTrades) {
            this.winningTrades = winningTrades;
            return this;
        }

        /**
         * Set losing trades.
         *
         * @param losingTrades Losing trades
         * @return Builder
         */
        public Builder losingTrades(Integer losingTrades) {
            this.losingTrades = losingTrades;
            return this;
        }

        /**
         * Set win rate.
         *
         * @param winRate Win rate
         * @return Builder
         */
        public Builder winRate(BigDecimal winRate) {
            this.winRate = winRate;
            return this;
        }

        /**
         * Set average profit.
         *
         * @param avgProfit Average profit
         * @return Builder
         */
        public Builder avgProfit(BigDecimal avgProfit) {
            this.avgProfit = avgProfit;
            return this;
        }

        /**
         * Set average loss.
         *
         * @param avgLoss Average loss
         * @return Builder
         */
        public Builder avgLoss(BigDecimal avgLoss) {
            this.avgLoss = avgLoss;
            return this;
        }

        /**
         * Set profit factor.
         *
         * @param profitFactor Profit factor
         * @return Builder
         */
        public Builder profitFactor(BigDecimal profitFactor) {
            this.profitFactor = profitFactor;
            return this;
        }

        /**
         * Set status.
         *
         * @param status Status
         * @return Builder
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Set error message.
         *
         * @param errorMessage Error message
         * @return Builder
         */
        public Builder errorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            return this;
        }

        /**
         * Set created at.
         *
         * @param createdAt Created at
         * @return Builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Set completed at.
         *
         * @param completedAt Completed at
         * @return Builder
         */
        public Builder completedAt(LocalDateTime completedAt) {
            this.completedAt = completedAt;
            return this;
        }

        /**
         * Build BacktestResultDto.
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
