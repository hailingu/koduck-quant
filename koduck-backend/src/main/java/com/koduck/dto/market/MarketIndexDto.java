package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Market index DTO.
 *
 * @author Koduck Team
 * @param symbol the symbol
 * @param name the name
 * @param type the type
 * @param price the price
 * @param change the change
 * @param changePercent the change percent
 * @param open the open price
 * @param high the high price
 * @param low the low price
 * @param prevClose the previous close price
 * @param volume the volume
 * @param amount the amount
 * @param timestamp the timestamp
 */
public record MarketIndexDto(
    String symbol,
    String name,
    String type,
    BigDecimal price,
    BigDecimal change,
    BigDecimal changePercent,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal prevClose,
    Long volume,
    BigDecimal amount,
    Instant timestamp
) {
    public MarketIndexDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }

    /**
     * Creates a new Builder instance.
     *
     * @return the builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for MarketIndexDto.
     */
    public static class Builder {

        /** The symbol. */
        private String symbol;

        /** The name. */
        private String name;

        /** The type. */
        private String type;

        /** The price. */
        private BigDecimal price;

        /** The change. */
        private BigDecimal change;

        /** The change percent. */
        private BigDecimal changePercent;

        /** The open price. */
        private BigDecimal open;

        /** The high price. */
        private BigDecimal high;

        /** The low price. */
        private BigDecimal low;

        /** The previous close price. */
        private BigDecimal prevClose;

        /** The volume. */
        private Long volume;

        /** The amount. */
        private BigDecimal amount;

        /** The timestamp. */
        private Instant timestamp;

        /**
         * Sets the symbol.
         *
         * @param symbol the symbol
         * @return the builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Sets the name.
         *
         * @param name the name
         * @return the builder
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the type.
         *
         * @param type the type
         * @return the builder
         */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /**
         * Sets the price.
         *
         * @param price the price
         * @return the builder
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * Sets the change.
         *
         * @param change the change
         * @return the builder
         */
        public Builder change(BigDecimal change) {
            this.change = change;
            return this;
        }

        /**
         * Sets the change percent.
         *
         * @param changePercent the change percent
         * @return the builder
         */
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }

        /**
         * Sets the open price.
         *
         * @param open the open price
         * @return the builder
         */
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }

        /**
         * Sets the high price.
         *
         * @param high the high price
         * @return the builder
         */
        public Builder high(BigDecimal high) {
            this.high = high;
            return this;
        }

        /**
         * Sets the low price.
         *
         * @param low the low price
         * @return the builder
         */
        public Builder low(BigDecimal low) {
            this.low = low;
            return this;
        }

        /**
         * Sets the previous close price.
         *
         * @param prevClose the previous close price
         * @return the builder
         */
        public Builder prevClose(BigDecimal prevClose) {
            this.prevClose = prevClose;
            return this;
        }

        /**
         * Sets the volume.
         *
         * @param volume the volume
         * @return the builder
         */
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }

        /**
         * Sets the amount.
         *
         * @param amount the amount
         * @return the builder
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Sets the timestamp.
         *
         * @param timestamp the timestamp
         * @return the builder
         */
        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Builds the MarketIndexDto.
         *
         * @return the MarketIndexDto
         */
        public MarketIndexDto build() {
            return new MarketIndexDto(
                symbol, name, type, price, change, changePercent,
                open, high, low, prevClose, volume, amount, timestamp
            );
        }
    }
}
