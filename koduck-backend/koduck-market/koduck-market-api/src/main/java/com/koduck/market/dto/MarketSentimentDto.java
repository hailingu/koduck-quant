package com.koduck.market.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Market sentiment analysis DTO.
 * Contains six-dimensional sentiment indicators.
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class MarketSentimentDto {

    /**
     * Timestamp of the sentiment data.
     */
    private String timestamp;

    /**
     * Overall sentiment score (0-100).
     */
    private int overall;

    /**
     * Market status description.
     * e.g., "strong_bullish", "bullish", "cautious_bullish", "neutral",
     *       "cautious_bearish", "bearish", "strong_bearish", "greedy", "fearful"
     */
    private String status;

    /**
     * Market code (e.g., "a_share", "hk_stock", "us_stock").
     */
    private String market;

    /**
     * Six-dimensional sentiment indicators.
     */
    private SentimentDimensions dimensions;

    /**
     * 创建新的 Builder 实例。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * MarketSentimentDto 的构建器。
     */
    public static final class Builder {
        /** 时间戳。 */
        private String timestamp;

        /** The overall score. */
        private Integer overall;
        /** 状态。 */
        private String status;

        /** The market. */
        private String market;

        /** The dimensions. */
        private SentimentDimensions dimensions;

        /**
 * 设置时间戳。
         *
         * @param timestamp 时间戳
         * @return 构建器
         */
        public Builder timestamp(String timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Sets the overall score.
         *
         * @param overall the overall score
         * @return 构建器
         */
        public Builder overall(Integer overall) {
            this.overall = overall;
            return this;
        }

        /**
         * 设置状态。
         *
         * @param status 状态
         * @return 构建器
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Sets the market.
         *
         * @param market the market
         * @return 构建器
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Sets the dimensions.
         *
         * @param dimensions the dimensions
         * @return 构建器
         */
        public Builder dimensions(SentimentDimensions dimensions) {
            this.dimensions = copyDimensions(dimensions);
            return this;
        }

        /**
         * Builds the MarketSentimentDto.
         *
         * @return the MarketSentimentDto
         */
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

    /**
     * Gets the dimensions with defensive copy.
     *
     * @return the dimensions
     */
    public SentimentDimensions getDimensions() {
        return copyDimensions(dimensions);
    }

    /**
     * Sets the dimensions with defensive copy.
     *
     * @param dimensions the dimensions
     */
    public void setDimensions(SentimentDimensions dimensions) {
        this.dimensions = copyDimensions(dimensions);
    }

    /**
     * Creates a defensive copy of SentimentDimension.
     *
     * @param source the source
     * @return the copy
     */
    private static SentimentDimension copyDimension(SentimentDimension source) {
        if (source == null) {
            return null;
        }
        SentimentDimension copy = new SentimentDimension();
        copy.setValue(source.getValue());
        copy.setTrend(source.getTrend());
        return copy;
    }

    /**
     * Creates a defensive copy of SentimentDimensions.
     *
     * @param source the source
     * @return the copy
     */
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
     * Sentiment dimension data.
     */
    @Data
    @NoArgsConstructor
    public static class SentimentDimension {
        /**
         * Dimension value (0-100).
         */
        private int value;

        /**
         * Trend direction: "up", "down", "neutral".
         */
        private String trend;

        /**
         * 创建新的 Builder 实例。
         *
         * @return 构建器
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder for SentimentDimension.
         */
        public static final class Builder {

            /** The value. */
            private Integer value;

            /** The trend. */
            private String trend;

            /**
             * Sets the value.
             *
             * @param value the value
             * @return 构建器
             */
            public Builder value(Integer value) {
                this.value = value;
                return this;
            }

            /**
             * Sets the trend.
             *
             * @param trend the trend
             * @return 构建器
             */
            public Builder trend(String trend) {
                this.trend = trend;
                return this;
            }

            /**
             * Builds the SentimentDimension.
             *
             * @return the SentimentDimension
             */
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
     * Container for all six dimensions.
     */
    @Data
    @NoArgsConstructor
    public static class SentimentDimensions {
        /**
         * Activity: Market trading activity level (0-100).
         * Higher = more active.
         */
        private SentimentDimension activity;

        /**
         * Volatility: Price volatility level (0-100).
         * Higher = more volatile.
         */
        private SentimentDimension volatility;

        /**
         * Trend Strength: Current trend strength (0-100).
         * Higher = stronger uptrend.
         */
        private SentimentDimension trendStrength;

        /**
         * Fear/Greed: Market sentiment (0-100).
         * 0 = extreme fear, 100 = extreme greed.
         */
        private SentimentDimension fearGreed;

        /**
         * Valuation: Current valuation level (0-100).
         * 0 = cheap, 100 = expensive.
         */
        private SentimentDimension valuation;

        /**
         * Fund Flow: Capital inflow/outflow (0-100).
         * Higher = more inflow.
         */
        private SentimentDimension fundFlow;

        /**
         * 创建新的 Builder 实例。
         *
         * @return 构建器
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder for SentimentDimensions.
         */
        public static final class Builder {

            /** The activity dimension. */
            private SentimentDimension activity;

            /** The volatility dimension. */
            private SentimentDimension volatility;

            /** The trend strength dimension. */
            private SentimentDimension trendStrength;

            /** The fear/greed dimension. */
            private SentimentDimension fearGreed;

            /** The valuation dimension. */
            private SentimentDimension valuation;

            /** The fund flow dimension. */
            private SentimentDimension fundFlow;

            /**
             * Sets the activity dimension.
             *
             * @param activity the activity
             * @return 构建器
             */
            public Builder activity(SentimentDimension activity) {
                this.activity = copyDimension(activity);
                return this;
            }

            /**
             * Sets the volatility dimension.
             *
             * @param volatility the volatility
             * @return 构建器
             */
            public Builder volatility(SentimentDimension volatility) {
                this.volatility = copyDimension(volatility);
                return this;
            }

            /**
             * Sets the trend strength dimension.
             *
             * @param trendStrength the trend strength
             * @return 构建器
             */
            public Builder trendStrength(SentimentDimension trendStrength) {
                this.trendStrength = copyDimension(trendStrength);
                return this;
            }

            /**
             * Sets the fear/greed dimension.
             *
             * @param fearGreed the fear/greed
             * @return 构建器
             */
            public Builder fearGreed(SentimentDimension fearGreed) {
                this.fearGreed = copyDimension(fearGreed);
                return this;
            }

            /**
             * Sets the valuation dimension.
             *
             * @param valuation the valuation
             * @return 构建器
             */
            public Builder valuation(SentimentDimension valuation) {
                this.valuation = copyDimension(valuation);
                return this;
            }

            /**
             * Sets the fund flow dimension.
             *
             * @param fundFlow the fund flow
             * @return 构建器
             */
            public Builder fundFlow(SentimentDimension fundFlow) {
                this.fundFlow = copyDimension(fundFlow);
                return this;
            }

            /**
             * Builds the SentimentDimensions.
             *
             * @return the SentimentDimensions
             */
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

        /**
         * Gets the activity dimension.
         *
         * @return the activity
         */
        public SentimentDimension getActivity() {
            return copyDimension(activity);
        }

        /**
         * Sets the activity dimension.
         *
         * @param activity the activity
         */
        public void setActivity(SentimentDimension activity) {
            this.activity = copyDimension(activity);
        }

        /**
         * Gets the volatility dimension.
         *
         * @return the volatility
         */
        public SentimentDimension getVolatility() {
            return copyDimension(volatility);
        }

        /**
         * Sets the volatility dimension.
         *
         * @param volatility the volatility
         */
        public void setVolatility(SentimentDimension volatility) {
            this.volatility = copyDimension(volatility);
        }

        /**
         * Gets the trend strength dimension.
         *
         * @return the trend strength
         */
        public SentimentDimension getTrendStrength() {
            return copyDimension(trendStrength);
        }

        /**
         * Sets the trend strength dimension.
         *
         * @param trendStrength the trend strength
         */
        public void setTrendStrength(SentimentDimension trendStrength) {
            this.trendStrength = copyDimension(trendStrength);
        }

        /**
         * Gets the fear/greed dimension.
         *
         * @return the fear/greed
         */
        public SentimentDimension getFearGreed() {
            return copyDimension(fearGreed);
        }

        /**
         * Sets the fear/greed dimension.
         *
         * @param fearGreed the fear/greed
         */
        public void setFearGreed(SentimentDimension fearGreed) {
            this.fearGreed = copyDimension(fearGreed);
        }

        /**
         * Gets the valuation dimension.
         *
         * @return the valuation
         */
        public SentimentDimension getValuation() {
            return copyDimension(valuation);
        }

        /**
         * Sets the valuation dimension.
         *
         * @param valuation the valuation
         */
        public void setValuation(SentimentDimension valuation) {
            this.valuation = copyDimension(valuation);
        }

        /**
         * Gets the fund flow dimension.
         *
         * @return the fund flow
         */
        public SentimentDimension getFundFlow() {
            return copyDimension(fundFlow);
        }

        /**
         * Sets the fund flow dimension.
         *
         * @param fundFlow the fund flow
         */
        public void setFundFlow(SentimentDimension fundFlow) {
            this.fundFlow = copyDimension(fundFlow);
        }
    }

    /**
     * Market status constants.
     */
    public static final class Status {

        /** Strong bullish status. */
        public static final String STRONG_BULLISH = "strong_bullish";

        /** Bullish status. */
        public static final String BULLISH = "bullish";

        /** Cautious bullish status. */
        public static final String CAUTIOUS_BULLISH = "cautious_bullish";

        /** Neutral status. */
        public static final String NEUTRAL = "neutral";

        /** Cautious bearish status. */
        public static final String CAUTIOUS_BEARISH = "cautious_bearish";

        /** Bearish status. */
        public static final String BEARISH = "bearish";

        /** Strong bearish status. */
        public static final String STRONG_BEARISH = "strong_bearish";

        /** Greedy status. */
        public static final String GREEDY = "greedy";

        /** Fearful status. */
        public static final String FEARFUL = "fearful";

        private Status() {
        }
    }
}
