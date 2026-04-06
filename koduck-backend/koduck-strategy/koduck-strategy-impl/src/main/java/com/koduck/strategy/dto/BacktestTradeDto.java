package com.koduck.strategy.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Backtest trade DTO.
 *
 * @param id ID
 * @param tradeType Trade type
 * @param tradeTime Trade time
 * @param symbol Symbol
 * @param price Price
 * @param quantity Quantity
 * @param amount Amount
 * @param commission Commission
 * @param slippageCost Slippage cost
 * @param totalCost Total cost
 * @param cashAfter Cash after
 * @param positionAfter Position after
 * @param pnl PnL
 * @param pnlPercent PnL percent
 * @param signalReason Signal reason
 * @author Koduck Team
 */
public record BacktestTradeDto(
    Long id,
    String tradeType,
    LocalDateTime tradeTime,
    String symbol,
    BigDecimal price,
    BigDecimal quantity,
    BigDecimal amount,
    BigDecimal commission,
    BigDecimal slippageCost,
    BigDecimal totalCost,
    BigDecimal cashAfter,
    BigDecimal positionAfter,
    BigDecimal pnl,
    BigDecimal pnlPercent,
    String signalReason
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
     * BacktestTradeDto 的构建器。
     */
    public static class Builder {
        /** ID。 */
        private Long id;
        /** 交易类型。 */
        private String tradeType;
        /** 交易时间。 */
        private LocalDateTime tradeTime;
        /** 品种代码。 */
        private String symbol;
        /** 价格。 */
        private BigDecimal price;
        /** 数量。 */
        private BigDecimal quantity;
        /** Amount. */
        private BigDecimal amount;
        /** Commission. */
        private BigDecimal commission;
        /** Slippage cost. */
        private BigDecimal slippageCost;
        /** Total cost. */
        private BigDecimal totalCost;
        /** Cash after. */
        private BigDecimal cashAfter;
        /** Position after. */
        private BigDecimal positionAfter;
        /** PnL. */
        private BigDecimal pnl;
        /** PnL percent. */
        private BigDecimal pnlPercent;
        /** Signal reason. */
        private String signalReason;

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
         * Set trade type.
         *
         * @param tradeType Trade type
         * @return Builder
         */
        public Builder tradeType(String tradeType) {
            this.tradeType = tradeType;
            return this;
        }

        /**
         * Set trade time.
         *
         * @param tradeTime Trade time
         * @return Builder
         */
        public Builder tradeTime(LocalDateTime tradeTime) {
            this.tradeTime = tradeTime;
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
         * Set price.
         *
         * @param price Price
         * @return Builder
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * Set quantity.
         *
         * @param quantity Quantity
         * @return Builder
         */
        public Builder quantity(BigDecimal quantity) {
            this.quantity = quantity;
            return this;
        }

        /**
         * Set amount.
         *
         * @param amount Amount
         * @return Builder
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Set commission.
         *
         * @param commission Commission
         * @return Builder
         */
        public Builder commission(BigDecimal commission) {
            this.commission = commission;
            return this;
        }

        /**
         * Set slippage cost.
         *
         * @param slippageCost Slippage cost
         * @return Builder
         */
        public Builder slippageCost(BigDecimal slippageCost) {
            this.slippageCost = slippageCost;
            return this;
        }

        /**
         * Set total cost.
         *
         * @param totalCost Total cost
         * @return Builder
         */
        public Builder totalCost(BigDecimal totalCost) {
            this.totalCost = totalCost;
            return this;
        }

        /**
         * Set cash after.
         *
         * @param cashAfter Cash after
         * @return Builder
         */
        public Builder cashAfter(BigDecimal cashAfter) {
            this.cashAfter = cashAfter;
            return this;
        }

        /**
         * Set position after.
         *
         * @param positionAfter Position after
         * @return Builder
         */
        public Builder positionAfter(BigDecimal positionAfter) {
            this.positionAfter = positionAfter;
            return this;
        }

        /**
         * Set PnL.
         *
         * @param pnl PnL
         * @return Builder
         */
        public Builder pnl(BigDecimal pnl) {
            this.pnl = pnl;
            return this;
        }

        /**
         * Set PnL percent.
         *
         * @param pnlPercent PnL percent
         * @return Builder
         */
        public Builder pnlPercent(BigDecimal pnlPercent) {
            this.pnlPercent = pnlPercent;
            return this;
        }

        /**
         * Set signal reason.
         *
         * @param signalReason Signal reason
         * @return Builder
         */
        public Builder signalReason(String signalReason) {
            this.signalReason = signalReason;
            return this;
        }

        /**
         * Build BacktestTradeDto.
         *
         * @return BacktestTradeDto 实例
         */
        public BacktestTradeDto build() {
            return new BacktestTradeDto(
                id,
                tradeType,
                tradeTime,
                symbol,
                price,
                quantity,
                amount,
                commission,
                slippageCost,
                totalCost,
                cashAfter,
                positionAfter,
                pnl,
                pnlPercent,
                signalReason
            );
        }
    }
}
