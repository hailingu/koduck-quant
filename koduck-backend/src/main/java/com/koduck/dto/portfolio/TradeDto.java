package com.koduck.dto.portfolio;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Trade record DTO.
 *
 * @param id the trade ID
 * @param market the market
 * @param symbol the stock symbol
 * @param name the stock name
 * @param tradeType the trade type (BUY/SELL)
 * @param status the trade status
 * @param notes the trade notes
 * @param quantity the quantity
 * @param price the price
 * @param amount the amount
 * @param tradeTime the trade time
 * @param createdAt the creation time
 * @author Koduck Team
 */
public record TradeDto(
    Long id,
    String market,
    String symbol,
    String name,
    String tradeType,
    String status,
    String notes,
    BigDecimal quantity,
    BigDecimal price,
    BigDecimal amount,
    LocalDateTime tradeTime,
    LocalDateTime createdAt
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    /**
     * Builder class for TradeDto.
     */
    public static class Builder {
        /** The trade ID. */
        private Long id;
        /** The market. */
        private String market;
        /** The stock symbol. */
        private String symbol;
        /** The stock name. */
        private String name;
        /** The trade type (BUY/SELL). */
        private String tradeType;
        /** The trade status. Default is SUCCESS. */
        private String status = "SUCCESS";
        /** The trade notes. */
        private String notes;
        /** The quantity. */
        private BigDecimal quantity;
        /** The price. */
        private BigDecimal price;
        /** The amount. */
        private BigDecimal amount;
        /** The trade time. */
        private LocalDateTime tradeTime;
        /** The creation time. */
        private LocalDateTime createdAt;

        /**
         * Sets the trade ID.
         *
         * @param id the trade ID
         * @return this Builder instance
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the market.
         *
         * @param market the market
         * @return this Builder instance
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Sets the stock symbol.
         *
         * @param symbol the stock symbol
         * @return this Builder instance
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Sets the stock name.
         *
         * @param name the stock name
         * @return this Builder instance
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the trade type.
         *
         * @param tradeType the trade type (BUY/SELL)
         * @return this Builder instance
         */
        public Builder tradeType(String tradeType) {
            this.tradeType = tradeType;
            return this;
        }

        /**
         * Sets the trade status.
         *
         * @param status the trade status
         * @return this Builder instance
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Sets the trade notes.
         *
         * @param notes the trade notes
         * @return this Builder instance
         */
        public Builder notes(String notes) {
            this.notes = notes;
            return this;
        }

        /**
         * Sets the quantity.
         *
         * @param quantity the quantity
         * @return this Builder instance
         */
        public Builder quantity(BigDecimal quantity) {
            this.quantity = quantity;
            return this;
        }

        /**
         * Sets the price.
         *
         * @param price the price
         * @return this Builder instance
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * Sets the amount.
         *
         * @param amount the amount
         * @return this Builder instance
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Sets the trade time.
         *
         * @param tradeTime the trade time
         * @return this Builder instance
         */
        public Builder tradeTime(LocalDateTime tradeTime) {
            this.tradeTime = tradeTime;
            return this;
        }

        /**
         * Sets the creation time.
         *
         * @param createdAt the creation time
         * @return this Builder instance
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Builds and returns a new TradeDto instance.
         *
         * @return a new TradeDto instance
         */
        public TradeDto build() {
            return new TradeDto(id, market, symbol, name, tradeType, status, notes,
                quantity, price, amount, tradeTime, createdAt);
        }
    }
}
