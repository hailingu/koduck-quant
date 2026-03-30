package com.koduck.dto.market;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Market sentiment analysis DTO.
 * Contains six-dimensional sentiment indicators.
 */
@Data
@NoArgsConstructor
public class MarketSentimentDto {

    /**
     * Timestamp of the sentiment data
     */
    private String timestamp;

    /**
     * Overall sentiment score (0-100)
     */
    private int overall;

    /**
     * Market status description
     * e.g., "strong_bullish", "bullish", "cautious_bullish", "neutral", 
     *       "cautious_bearish", "bearish", "strong_bearish", "greedy", "fearful"
     */
    private String status;

    /**
     * Market code (e.g., "a_share", "hk_stock", "us_stock")
     */
    private String market;

    /**
     * Six-dimensional sentiment indicators
     */
    private SentimentDimensions dimensions;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String timestamp;
        private Integer overall;
        private String status;
        private String market;
        private SentimentDimensions dimensions;

        public Builder timestamp(String timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public Builder overall(Integer overall) {
            this.overall = overall;
            return this;
        }

        public Builder status(String status) {
            this.status = status;
            return this;
        }

        public Builder market(String market) {
            this.market = market;
            return this;
        }

        public Builder dimensions(SentimentDimensions dimensions) {
            this.dimensions = copyDimensions(dimensions);
            return this;
        }

        public MarketSentimentDto build() {
            MarketSentimentDto sentiment = new MarketSentimentDto();
            sentiment.setTimestamp(timestamp);
            if (overall != null) {
                sentiment.setOverall(overall);
            }
            sentiment.setStatus(status);
            sentiment.setMarket(market);
            sentiment.setDimensions(dimensions);
            return sentiment;
        }
    }

    public SentimentDimensions getDimensions() {
        return copyDimensions(dimensions);
    }

    public void setDimensions(SentimentDimensions dimensions) {
        this.dimensions = copyDimensions(dimensions);
    }

    private static SentimentDimension copyDimension(SentimentDimension source) {
        if (source == null) {
            return null;
        }
        SentimentDimension copy = new SentimentDimension();
        copy.setValue(source.getValue());
        copy.setTrend(source.getTrend());
        return copy;
    }

    private static SentimentDimensions copyDimensions(SentimentDimensions source) {
        if (source == null) {
            return null;
        }
        SentimentDimensions copy = new SentimentDimensions();
        copy.setActivity(copyDimension(source.getActivity()));
        copy.setVolatility(copyDimension(source.getVolatility()));
        copy.setTrendStrength(copyDimension(source.getTrendStrength()));
        copy.setFearGreed(copyDimension(source.getFearGreed()));
        copy.setValuation(copyDimension(source.getValuation()));
        copy.setFundFlow(copyDimension(source.getFundFlow()));
        return copy;
    }

    /**
     * Sentiment dimension data
     */
    @Data
    @NoArgsConstructor
    public static class SentimentDimension {
        /**
         * Dimension value (0-100)
         */
        private int value;

        /**
         * Trend direction: "up", "down", "neutral"
         */
        private String trend;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private Integer value;
            private String trend;

            public Builder value(Integer value) {
                this.value = value;
                return this;
            }

            public Builder trend(String trend) {
                this.trend = trend;
                return this;
            }

            public SentimentDimension build() {
                SentimentDimension dimension = new SentimentDimension();
                if (value != null) {
                    dimension.setValue(value);
                }
                dimension.setTrend(trend);
                return dimension;
            }
        }

    }

    /**
     * Container for all six dimensions
     */
    @Data
    @NoArgsConstructor
    public static class SentimentDimensions {
        /**
         * Activity: Market trading activity level (0-100)
         * Higher = more active
         */
        private SentimentDimension activity;

        /**
         * Volatility: Price volatility level (0-100)
         * Higher = more volatile
         */
        private SentimentDimension volatility;

        /**
         * Trend Strength: Current trend strength (0-100)
         * Higher = stronger uptrend
         */
        private SentimentDimension trendStrength;

        /**
         * Fear/Greed: Market sentiment (0-100)
         * 0 = extreme fear, 100 = extreme greed
         */
        private SentimentDimension fearGreed;

        /**
         * Valuation: Current valuation level (0-100)
         * 0 = cheap, 100 = expensive
         */
        private SentimentDimension valuation;

        /**
         * Fund Flow: Capital inflow/outflow (0-100)
         * Higher = more inflow
         */
        private SentimentDimension fundFlow;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private SentimentDimension activity;
            private SentimentDimension volatility;
            private SentimentDimension trendStrength;
            private SentimentDimension fearGreed;
            private SentimentDimension valuation;
            private SentimentDimension fundFlow;

            public Builder activity(SentimentDimension activity) {
                this.activity = copyDimension(activity);
                return this;
            }

            public Builder volatility(SentimentDimension volatility) {
                this.volatility = copyDimension(volatility);
                return this;
            }

            public Builder trendStrength(SentimentDimension trendStrength) {
                this.trendStrength = copyDimension(trendStrength);
                return this;
            }

            public Builder fearGreed(SentimentDimension fearGreed) {
                this.fearGreed = copyDimension(fearGreed);
                return this;
            }

            public Builder valuation(SentimentDimension valuation) {
                this.valuation = copyDimension(valuation);
                return this;
            }

            public Builder fundFlow(SentimentDimension fundFlow) {
                this.fundFlow = copyDimension(fundFlow);
                return this;
            }

            public SentimentDimensions build() {
                SentimentDimensions dimensions = new SentimentDimensions();
                dimensions.setActivity(activity);
                dimensions.setVolatility(volatility);
                dimensions.setTrendStrength(trendStrength);
                dimensions.setFearGreed(fearGreed);
                dimensions.setValuation(valuation);
                dimensions.setFundFlow(fundFlow);
                return dimensions;
            }
        }

        public SentimentDimension getActivity() {
            return copyDimension(activity);
        }

        public void setActivity(SentimentDimension activity) {
            this.activity = copyDimension(activity);
        }

        public SentimentDimension getVolatility() {
            return copyDimension(volatility);
        }

        public void setVolatility(SentimentDimension volatility) {
            this.volatility = copyDimension(volatility);
        }

        public SentimentDimension getTrendStrength() {
            return copyDimension(trendStrength);
        }

        public void setTrendStrength(SentimentDimension trendStrength) {
            this.trendStrength = copyDimension(trendStrength);
        }

        public SentimentDimension getFearGreed() {
            return copyDimension(fearGreed);
        }

        public void setFearGreed(SentimentDimension fearGreed) {
            this.fearGreed = copyDimension(fearGreed);
        }

        public SentimentDimension getValuation() {
            return copyDimension(valuation);
        }

        public void setValuation(SentimentDimension valuation) {
            this.valuation = copyDimension(valuation);
        }

        public SentimentDimension getFundFlow() {
            return copyDimension(fundFlow);
        }

        public void setFundFlow(SentimentDimension fundFlow) {
            this.fundFlow = copyDimension(fundFlow);
        }
    }

    /**
     * Market status constants
     */
    public static class Status {
        private Status() {
        }

        public static final String STRONG_BULLISH = "strong_bullish";
        public static final String BULLISH = "bullish";
        public static final String CAUTIOUS_BULLISH = "cautious_bullish";
        public static final String NEUTRAL = "neutral";
        public static final String CAUTIOUS_BEARISH = "cautious_bearish";
        public static final String BEARISH = "bearish";
        public static final String STRONG_BEARISH = "strong_bearish";
        public static final String GREEDY = "greedy";
        public static final String FEARFUL = "fearful";
    }
}
