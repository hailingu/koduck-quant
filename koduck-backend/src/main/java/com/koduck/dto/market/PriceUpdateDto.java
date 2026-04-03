package com.koduck.dto.market;

/**
 * Price update data transfer object.
 * Used for real-time price updates and WebSocket messages.
 *
 * @param symbol the stock symbol
 * @param name the stock name
 * @param price the current price
 * @param change the price change
 * @param changePercent the price change percentage
 * @param volume the trading volume
 * @author Koduck Team
 */
public record PriceUpdateDto(
    String symbol,
    String name,
    Double price,
    Double change,
    Double changePercent,
    Long volume
) {
    public PriceUpdateDto {
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
     * Builder for PriceUpdateDto.
     */
    public static class Builder {
        /** The stock symbol. */
        private String symbol;

        /** The stock name. */
        private String name;

        /** The current price. */
        private Double price;

        /** The price change. */
        private Double change;

        /** The price change percentage. */
        private Double changePercent;

        /** The trading volume. */
        private Long volume;

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
         * Sets the price.
         *
         * @param price the price
         * @return the builder
         */
        public Builder price(Double price) {
            this.price = price;
            return this;
        }

        /**
         * Sets the change.
         *
         * @param change the change
         * @return the builder
         */
        public Builder change(Double change) {
            this.change = change;
            return this;
        }

        /**
         * Sets the change percent.
         *
         * @param changePercent the change percent
         * @return the builder
         */
        public Builder changePercent(Double changePercent) {
            this.changePercent = changePercent;
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
         * Builds the PriceUpdateDto.
         *
         * @return the PriceUpdateDto
         */
        public PriceUpdateDto build() {
            return new PriceUpdateDto(symbol, name, price, change, changePercent, volume);
        }
    }
}
