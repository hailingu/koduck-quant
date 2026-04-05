package com.koduck.market.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * Unified K-line data model across all markets.
 * This is the standard format that all providers must convert their data to.
 *
 * @author Koduck Team
 * @param symbol the stock symbol
 * @param market the market code
 * @param timestamp the timestamp of the kline
 * @param open the opening price
 * @param high the highest price
 * @param low the lowest price
 * @param close the closing price
 * @param volume the trading volume
 * @param amount the trading amount
 * @param timeframe the timeframe of the kline
 */
public record KlineData(
    String symbol,

    String market,

    Instant timestamp,

    BigDecimal open,

    BigDecimal high,

    BigDecimal low,

    BigDecimal close,

    Long volume,

    BigDecimal amount,

    String timeframe
) {

    /** Scale for price change percentage calculation. */
    private static final int PRICE_CHANGE_SCALE = 4;

    /** Multiplier for percentage conversion. */
    private static final int PERCENT_MULTIPLIER = 100;

    public KlineData {
        if (amount == null) {
            amount = BigDecimal.ZERO;
        }
    }

    /**
     * Calculate price change.
     *
     * @return the price change (close - open)
     */
    public BigDecimal getPriceChange() {
        return close.subtract(open);
    }

    /**
     * Calculate price change percentage.
     *
     * @return the price change percentage
     */
    public BigDecimal getPriceChangePercent() {
        if (open.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return close.subtract(open)
                   .divide(open, PRICE_CHANGE_SCALE, RoundingMode.HALF_UP)
                   .multiply(BigDecimal.valueOf(PERCENT_MULTIPLIER));
    }

    /**
     * Check if this is a rising k-line.
     *
     * @return true if close >= open
     */
    public boolean isRising() {
        return close.compareTo(open) >= 0;
    }

    /**
     * Builder for KlineData.
     *
     * @return a new Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for KlineData.
     */
    public static class Builder {
        /** The stock symbol. */
        private String symbol;

        /** The market code. */
        private String market;

        /** The timestamp. */
        private Instant timestamp;

        /** The opening price. */
        private BigDecimal open;

        /** The highest price. */
        private BigDecimal high;

        /** The lowest price. */
        private BigDecimal low;

        /** The closing price. */
        private BigDecimal close;

        /** The trading volume. */
        private Long volume;

        /** The trading amount. */
        private BigDecimal amount;

        /** The timeframe. */
        private String timeframe;

        /**
         * Set the symbol.
         *
         * @param symbol the stock symbol
         * @return this builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Set the market.
         *
         * @param market the market code
         * @return this builder
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Set the timestamp.
         *
         * @param timestamp the timestamp
         * @return this builder
         */
        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Set the open price.
         *
         * @param open the opening price
         * @return this builder
         */
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }

        /**
         * Set the high price.
         *
         * @param high the highest price
         * @return this builder
         */
        public Builder high(BigDecimal high) {
            this.high = high;
            return this;
        }

        /**
         * Set the low price.
         *
         * @param low the lowest price
         * @return this builder
         */
        public Builder low(BigDecimal low) {
            this.low = low;
            return this;
        }

        /**
         * Set the close price.
         *
         * @param close the closing price
         * @return this builder
         */
        public Builder close(BigDecimal close) {
            this.close = close;
            return this;
        }

        /**
         * Set the volume.
         *
         * @param volume the trading volume
         * @return this builder
         */
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }

        /**
         * Set the amount.
         *
         * @param amount the trading amount
         * @return this builder
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Set the timeframe.
         *
         * @param timeframe the timeframe
         * @return this builder
         */
        public Builder timeframe(String timeframe) {
            this.timeframe = timeframe;
            return this;
        }

        /**
         * Build the KlineData.
         *
         * @return a new KlineData instance
         */
        public KlineData build() {
            return new KlineData(symbol, market, timestamp, open, high, low,
                                close, volume, amount, timeframe);
        }
    }
}
