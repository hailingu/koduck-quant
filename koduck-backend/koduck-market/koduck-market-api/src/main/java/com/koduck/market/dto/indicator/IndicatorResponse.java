package com.koduck.market.dto.indicator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import com.koduck.util.CollectionCopyUtils;

/**
 * 技术指标响应数据传输对象。
 *
 * @param symbol 股票代码
 * @param market 市场标识符
 * @param indicator 指标名称
 * @param period 指标周期
 * @param values 指标值映射
 * @param trend 趋势方向
 * @param timestamp 指标数据的时间戳
 * @author Koduck Team
 */
public record IndicatorResponse(
    // 股票代码。
    String symbol,
    // 市场标识符。
    String market,
    // 指标名称。
    String indicator,
    // 指标周期。
    Integer period,
    // 指标值映射。
    Map<String, BigDecimal> values,
    // 趋势方向。
    String trend,
    // 指标数据的时间戳。
    LocalDateTime timestamp
) {

    /**
 * 紧凑构造函数，用于创建值的防御性拷贝。
     *
     * @param values 值映射
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
     * IndicatorResponse 的构建器类。
     */
    public static class Builder {
        /** 股票代码。 */
        private String symbol;
        /** 市场标识符。 */
        private String market;
        /** 指标名称。 */
        private String indicator;
        /** 指标周期。 */
        private Integer period;
        /** 指标值映射。 */
        private Map<String, BigDecimal> values;
        /** 趋势方向。 */
        private String trend;
        /** 指标数据的时间戳。 */
        private LocalDateTime timestamp;

        /**
 * 设置股票代码。
         *
         * @param symbol 品种代码
         * @return this builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
 * 设置市场标识符。
         *
         * @param market the market
         * @return this builder
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
 * 设置指标名称。
         *
         * @param indicator the indicator
         * @return this builder
         */
        public Builder indicator(String indicator) {
            this.indicator = indicator;
            return this;
        }

        /**
 * 设置指标周期。
         *
         * @param period the period
         * @return this builder
         */
        public Builder period(Integer period) {
            this.period = period;
            return this;
        }

        /**
 * 设置指标值。
         *
         * @param values 值映射
         * @return this builder
         */
        public Builder values(Map<String, BigDecimal> values) {
            this.values = CollectionCopyUtils.copyMap(values);
            return this;
        }

        /**
 * 设置趋势方向。
         *
         * @param trend the trend
         * @return this builder
         */
        public Builder trend(String trend) {
            this.trend = trend;
            return this;
        }

        /**
 * 设置时间戳。
         *
         * @param timestamp 时间戳
         * @return this builder
         */
        public Builder timestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
 * 构建 IndicatorResponse 实例。
         *
         * @return 构建的 IndicatorResponse
         */
        public IndicatorResponse build() {
            return new IndicatorResponse(
                symbol, market, indicator, period, values, trend, timestamp
            );
        }
    }
}
