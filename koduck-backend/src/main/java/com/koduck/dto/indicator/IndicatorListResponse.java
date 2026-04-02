package com.koduck.dto.indicator;

import java.util.List;

import com.koduck.util.CollectionCopyUtils;

/**
 * Available indicators list response.
 *
 * @author Koduck Team
 */
public record IndicatorListResponse(
    /** List of indicator information. */
    List<IndicatorInfo> indicators
) {

    /**
     * Compact constructor to make defensive copy of indicators.
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
     * Information about a single indicator.
     *
     * @param code the indicator code
     * @param name the indicator name
     * @param description the indicator description
     * @param defaultPeriods the default periods for this indicator
     * @param category the indicator category
     */
    public record IndicatorInfo(
        /** Indicator code. */
        String code,
        /** Indicator name. */
        String name,
        /** Indicator description. */
        String description,
        /** Default periods for this indicator. */
        List<Integer> defaultPeriods,
        /** Indicator category. */
        String category
    ) {

        /**
         * Compact constructor to make defensive copy of defaultPeriods.
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
     * Builder class for IndicatorListResponse.
     */
    public static class Builder {
        /** List of indicator information. */
        private List<IndicatorInfo> indicators;

        /**
         * Sets the indicators list.
         *
         * @param indicators the indicators
         * @return this builder
         */
        public Builder indicators(List<IndicatorInfo> indicators) {
            this.indicators = CollectionCopyUtils.copyList(indicators);
            return this;
        }

        /**
         * Builds the IndicatorListResponse instance.
         *
         * @return the built IndicatorListResponse
         */
        public IndicatorListResponse build() {
            return new IndicatorListResponse(indicators);
        }
    }
}
