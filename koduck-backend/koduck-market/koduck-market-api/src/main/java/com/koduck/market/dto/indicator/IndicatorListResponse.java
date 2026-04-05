package com.koduck.market.dto.indicator;

import java.util.List;

import com.koduck.util.CollectionCopyUtils;

/**
 * 可用指标列表响应。
 *
 * @author Koduck Team
 * @param indicators the list of indicator information
 */
public record IndicatorListResponse(
    List<IndicatorInfo> indicators
) {

    /**
 * 紧凑构造函数，用于创建指标的防御性拷贝。
     *
     * @param indicators the indicators list
     */
    public IndicatorListResponse {
        indicators = CollectionCopyUtils.copyList(indicators);
    }

    @Override
    public List<IndicatorInfo> indicators() {
        return CollectionCopyUtils.copyList(indicators);
    }

    /**
     * 单个指标的信息。
     *
     * @param code the indicator code
     * @param name the indicator name
     * @param description the indicator description
     * @param defaultPeriods the default periods for this indicator
     * @param category the indicator category
     */
    public record IndicatorInfo(
        String code,
        String name,
        String description,
        List<Integer> defaultPeriods,
        String category
    ) {

        /**
 * 紧凑构造函数，用于创建默认周期的防御性拷贝。
         *
         * @param defaultPeriods the default periods list
         */
        public IndicatorInfo {
            defaultPeriods = CollectionCopyUtils.copyList(defaultPeriods);
        }

        @Override
        public List<Integer> defaultPeriods() {
            return CollectionCopyUtils.copyList(defaultPeriods);
        }
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
     * IndicatorListResponse 的构建器类。
     */
    public static class Builder {
        /** 指标信息列表。 */
        private List<IndicatorInfo> indicators;

        /**
 * 设置指标列表。
         *
         * @param indicators the indicators
         * @return this builder
         */
        public Builder indicators(List<IndicatorInfo> indicators) {
            this.indicators = CollectionCopyUtils.copyList(indicators);
            return this;
        }

        /**
 * 构建 IndicatorListResponse 实例。
         *
         * @return 构建的 IndicatorListResponse
         */
        public IndicatorListResponse build() {
            return new IndicatorListResponse(indicators);
        }
    }
}
