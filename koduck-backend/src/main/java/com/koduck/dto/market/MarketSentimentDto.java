package com.koduck.dto.market;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Market sentiment analysis DTO.
 * Contains six-dimensional sentiment indicators.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
        return SentimentDimension.builder()
                .value(source.getValue())
                .trend(source.getTrend())
                .build();
    }

    private static SentimentDimensions copyDimensions(SentimentDimensions source) {
        if (source == null) {
            return null;
        }
        return SentimentDimensions.builder()
                .activity(copyDimension(source.getActivity()))
                .volatility(copyDimension(source.getVolatility()))
                .trendStrength(copyDimension(source.getTrendStrength()))
                .fearGreed(copyDimension(source.getFearGreed()))
                .valuation(copyDimension(source.getValuation()))
                .fundFlow(copyDimension(source.getFundFlow()))
                .build();
    }

    /**
     * Sentiment dimension data
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentDimension {
        /**
         * Dimension value (0-100)
         */
        private int value;

        /**
         * Trend direction: "up", "down", "neutral"
         */
        private String trend;

    }

    /**
     * Container for all six dimensions
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
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
