package com.koduck.dto.indicator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import com.koduck.util.CollectionCopyUtils;

/**
 * Technical indicator response DTO.
 *
 * @param symbol the stock symbol
 * @param market the market identifier
 * @param indicator the indicator name
 * @param period the indicator period
 * @param values the indicator values map
 * @param trend the trend direction
 * @param timestamp the timestamp of the indicator data
 * @author Koduck Team
 */
public record IndicatorResponse(
    /** Stock symbol. */
    String symbol,
    /** Market identifier. */
    String market,
    /** Indicator name. */
    String indicator,
    /** Indicator period. */
    Integer period,
    /** Indicator values map. */
    Map<String, BigDecimal> values,
    /** Trend direction. */
    String trend,
    /** Timestamp of the indicator data. */
    LocalDateTime timestamp
) {

    /**
     * Compact constructor to make defensive copy of values.
     *
     * @param values the values map
     */
    public IndicatorResponse {
        values = CollectionCopyUtils.copyMap(values);
    }

    @Override
    public Map<String, BigDecimal> values() {
        return CollectionCopyUtils.copyMap(values);
    }

    /**
     * Creates a new builder instance.
     *
     * @return a new Builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for IndicatorResponse.
     */
    public static class Builder {
        /** Stock symbol. */
        private String symbol;
        /** Market identifier. */
        private String market;
        /** Indicator name. */
        private String indicator;
        /** Indicator period. */
        private Integer period;
        /** Indicator values map. */
        private Map<String, BigDecimal> values;
        /** Trend direction. */
        private String trend;
        /** Timestamp of the indicator data. */
        private LocalDateTime timestamp;

        /**
         * Sets the stock symbol.
         *
         * @param symbol the symbol
         * @return this builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Sets the market identifier.
         *
         * @param market the market
         * @return this builder
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Sets the indicator name.
         *
         * @param indicator the indicator
         * @return this builder
         */
        public Builder indicator(String indicator) {
            this.indicator = indicator;
            return this;
        }

        /**
         * Sets the indicator period.
         *
         * @param period the period
         * @return this builder
         */
        public Builder period(Integer period) {
            this.period = period;
            return this;
        }

        /**
         * Sets the indicator values.
         *
         * @param values the values map
         * @return this builder
         */
        public Builder values(Map<String, BigDecimal> values) {
            this.values = CollectionCopyUtils.copyMap(values);
            return this;
        }

        /**
         * Sets the trend direction.
         *
         * @param trend the trend
         * @return this builder
         */
        public Builder trend(String trend) {
            this.trend = trend;
            return this;
        }

        /**
         * Sets the timestamp.
         *
         * @param timestamp the timestamp
         * @return this builder
         */
        public Builder timestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Builds the IndicatorResponse instance.
         *
         * @return the built IndicatorResponse
         */
        public IndicatorResponse build() {
            return new IndicatorResponse(
                symbol, market, indicator, period, values, trend, timestamp
            );
        }
    }
}
