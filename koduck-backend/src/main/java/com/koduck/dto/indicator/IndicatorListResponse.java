package com.koduck.dto.indicator;

import java.util.List;

import com.koduck.util.CollectionCopyUtils;

/**
 * Available indicators list response.
 *
 * @author Koduck Team
 * @param indicators the list of indicator information
 */
public record IndicatorListResponse(
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
        String code,
        String name,
        String description,
        List<Integer> defaultPeriods,
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
