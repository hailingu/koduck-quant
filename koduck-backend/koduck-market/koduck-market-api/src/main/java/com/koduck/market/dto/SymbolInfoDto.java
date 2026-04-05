package com.koduck.market.dto;

import java.math.BigDecimal;

/**
 * Stock symbol information DTO.
 *
 * @author Koduck Team
 * @param symbol the stock symbol
 * @param name the stock name
 * @param type the stock type
 * @param market the market code
 * @param price the current price
 * @param changePercent the price change percentage
 * @param volume the trading volume
 * @param amount the trading amount
 */
public record SymbolInfoDto(
    String symbol,
    String name,
    String type,
    String market,
    BigDecimal price,
    BigDecimal changePercent,
    Long volume,
    BigDecimal amount
) {
    /**
     * Compact constructor for validation.
     *
     * @param symbol the stock symbol
     * @param name the stock name
     * @param type the stock type
     * @param market the market code
     * @param price the current price
     * @param changePercent the price change percentage
     * @param volume the trading volume
     * @param amount the trading amount
     */
    public SymbolInfoDto {
        // Compact constructor for validation
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }

    /**
     * Get a builder for SymbolInfoDto.
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for SymbolInfoDto.
     */
    public static class Builder {
        /** The stock symbol. */
        private String symbol;

        /** The stock name. */
        private String name;

        /** The stock type. */
        private String type;

        /** The market code. */
        private String market;

        /** The current price. */
        private BigDecimal price;

        /** The price change percentage. */
        private BigDecimal changePercent;

        /** The trading volume. */
        private Long volume;

        /** The trading amount. */
        private BigDecimal amount;

        /**
         * Set the symbol.
         *
         * @param symbol the stock symbol
         * @return 构建器
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Set the name.
         *
         * @param name the stock name
         * @return 构建器
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Set the type.
         *
         * @param type the stock type
         * @return 构建器
         */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /**
         * Set the market.
         *
         * @param market the market code
         * @return 构建器
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Set the price.
         *
         * @param price the current price
         * @return 构建器
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * Set the change percent.
         *
         * @param changePercent the price change percentage
         * @return 构建器
         */
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }

        /**
         * Set the volume.
         *
         * @param volume the trading volume
         * @return 构建器
         */
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }

        /**
         * Set the amount.
         *
         * @param amount the trading amount
         * @return 构建器
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Build the SymbolInfoDto.
         *
         * @return the SymbolInfoDto
         */
        public SymbolInfoDto build() {
            return new SymbolInfoDto(symbol, name, type, market, price, changePercent, volume, amount);
        }
    }
}
