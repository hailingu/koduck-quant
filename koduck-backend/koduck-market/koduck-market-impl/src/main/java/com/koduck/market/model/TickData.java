package com.koduck.market.model;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Real-time tick data model.
 * Represents a single trade/tick in the market.
 *
 * @author Koduck Team
 * @param symbol the stock symbol
 * @param market the market code
 * @param timestamp the timestamp of the tick
 * @param price the current price
 * @param change the price change
 * @param changePercent the price change percentage
 * @param volume the trading volume
 * @param amount the trading amount
 * @param bidPrice the bid price
 * @param bidVolume the bid volume
 * @param askPrice the ask price
 * @param askVolume the ask volume
 * @param dayHigh the day's highest price
 * @param dayLow the day's lowest price
 * @param open the opening price
 * @param prevClose the previous close price
 */
public record TickData(
    String symbol,

    String market,

    Instant timestamp,

    BigDecimal price,

    BigDecimal change,

    BigDecimal changePercent,

    Long volume,

    BigDecimal amount,

    BigDecimal bidPrice,

    Long bidVolume,

    BigDecimal askPrice,

    Long askVolume,

    BigDecimal dayHigh,

    BigDecimal dayLow,

    BigDecimal open,

    BigDecimal prevClose
) {

    /**
     * Check if price is rising.
     *
     * @return true if price is rising
     */
    public boolean isRising() {
        return change != null && change.compareTo(BigDecimal.ZERO) > 0;
    }

    /**
     * Check if price is falling.
     *
     * @return true if price is falling
     */
    public boolean isFalling() {
        return change != null && change.compareTo(BigDecimal.ZERO) < 0;
    }

    /**
     * Get spread between ask and bid.
     *
     * @return the spread value
     */
    public BigDecimal getSpread() {
        if (askPrice == null || bidPrice == null) {
            return BigDecimal.ZERO;
        }
        return askPrice.subtract(bidPrice);
    }

    /**
     * Builder for TickData.
     *
     * @return a new Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for TickData.
     */
    public static class Builder {
        /** The stock symbol. */
        private String symbol;

        /** The market code. */
        private String market;

        /** The timestamp. */
        private Instant timestamp;

        /** The current price. */
        private BigDecimal price;

        /** The price change. */
        private BigDecimal change;

        /** The price change percentage. */
        private BigDecimal changePercent;

        /** The trading volume. */
        private Long volume;

        /** The trading amount. */
        private BigDecimal amount;

        /** The bid price. */
        private BigDecimal bidPrice;

        /** The bid volume. */
        private Long bidVolume;

        /** The ask price. */
        private BigDecimal askPrice;

        /** The ask volume. */
        private Long askVolume;

        /** The day's highest price. */
        private BigDecimal dayHigh;

        /** The day's lowest price. */
        private BigDecimal dayLow;

        /** The opening price. */
        private BigDecimal open;

        /** The previous close price. */
        private BigDecimal prevClose;

        /**
         * Set the symbol.
         *
         * @param symbol the stock symbol
         * @return the Builder instance
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Set the market.
         *
         * @param market the market code
         * @return the Builder instance
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Set the timestamp.
         *
         * @param timestamp the timestamp
         * @return the Builder instance
         */
        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Set the price.
         *
         * @param price the current price
         * @return the Builder instance
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * Set the change.
         *
         * @param change the price change
         * @return the Builder instance
         */
        public Builder change(BigDecimal change) {
            this.change = change;
            return this;
        }

        /**
         * Set the change percent.
         *
         * @param changePercent the price change percentage
         * @return the Builder instance
         */
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }

        /**
         * Set the volume.
         *
         * @param volume the trading volume
         * @return the Builder instance
         */
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }

        /**
         * Set the amount.
         *
         * @param amount the trading amount
         * @return the Builder instance
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Set the bid price.
         *
         * @param bidPrice the bid price
         * @return the Builder instance
         */
        public Builder bidPrice(BigDecimal bidPrice) {
            this.bidPrice = bidPrice;
            return this;
        }

        /**
         * Set the bid volume.
         *
         * @param bidVolume the bid volume
         * @return the Builder instance
         */
        public Builder bidVolume(Long bidVolume) {
            this.bidVolume = bidVolume;
            return this;
        }

        /**
         * Set the ask price.
         *
         * @param askPrice the ask price
         * @return the Builder instance
         */
        public Builder askPrice(BigDecimal askPrice) {
            this.askPrice = askPrice;
            return this;
        }

        /**
         * Set the ask volume.
         *
         * @param askVolume the ask volume
         * @return the Builder instance
         */
        public Builder askVolume(Long askVolume) {
            this.askVolume = askVolume;
            return this;
        }

        /**
         * Set the day high.
         *
         * @param dayHigh the day's highest price
         * @return the Builder instance
         */
        public Builder dayHigh(BigDecimal dayHigh) {
            this.dayHigh = dayHigh;
            return this;
        }

        /**
         * Set the day low.
         *
         * @param dayLow the day's lowest price
         * @return the Builder instance
         */
        public Builder dayLow(BigDecimal dayLow) {
            this.dayLow = dayLow;
            return this;
        }

        /**
         * Set the open price.
         *
         * @param open the opening price
         * @return the Builder instance
         */
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }

        /**
         * Set the previous close.
         *
         * @param prevClose the previous close price
         * @return the Builder instance
         */
        public Builder prevClose(BigDecimal prevClose) {
            this.prevClose = prevClose;
            return this;
        }

        /**
         * Build the TickData instance.
         *
         * @return the TickData instance
         */
        public TickData build() {
            return new TickData(symbol, market, timestamp, price, change, changePercent,
                              volume, amount, bidPrice, bidVolume, askPrice, askVolume,
                              dayHigh, dayLow, open, prevClose);
        }
    }
}
