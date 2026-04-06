package com.koduck.strategy.dto;

import java.math.BigDecimal;

/**
 * Strategy parameter DTO.
 *
 * @author Koduck Team
 * @param id the parameter ID
 * @param paramName the parameter name
 * @param paramType the parameter type
 * @param defaultValue the default value
 * @param minValue the minimum value
 * @param maxValue the maximum value
 * @param description the parameter description
 * @param isRequired whether the parameter is required
 * @param sortOrder the sort order
 */
public record StrategyParameterDto(
    Long id,
    String paramName,
    String paramType,
    String defaultValue,
    BigDecimal minValue,
    BigDecimal maxValue,
    String description,
    Boolean isRequired,
    Integer sortOrder
) {

    /**
     * Get a builder for StrategyParameterDto.
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for StrategyParameterDto.
     */
    public static class Builder {
        /** The parameter ID. */
        private Long id;

        /** The parameter name. */
        private String paramName;

        /** The parameter type. */
        private String paramType;

        /** The default value. */
        private String defaultValue;

        /** The minimum value. */
        private BigDecimal minValue;

        /** The maximum value. */
        private BigDecimal maxValue;

        /** The parameter description. */
        private String description;

        /** Whether the parameter is required. */
        private Boolean isRequired;

        /** The sort order. */
        private Integer sortOrder;

        /**
         * Set the ID.
         *
         * @param id the parameter ID
         * @return 构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Set the parameter name.
         *
         * @param paramName the parameter name
         * @return 构建器
         */
        public Builder paramName(String paramName) {
            this.paramName = paramName;
            return this;
        }

        /**
         * Set the parameter type.
         *
         * @param paramType the parameter type
         * @return 构建器
         */
        public Builder paramType(String paramType) {
            this.paramType = paramType;
            return this;
        }

        /**
         * Set the default value.
         *
         * @param defaultValue the default value
         * @return 构建器
         */
        public Builder defaultValue(String defaultValue) {
            this.defaultValue = defaultValue;
            return this;
        }

        /**
         * Set the minimum value.
         *
         * @param minValue the minimum value
         * @return 构建器
         */
        public Builder minValue(BigDecimal minValue) {
            this.minValue = minValue;
            return this;
        }

        /**
         * Set the maximum value.
         *
         * @param maxValue the maximum value
         * @return 构建器
         */
        public Builder maxValue(BigDecimal maxValue) {
            this.maxValue = maxValue;
            return this;
        }

        /**
         * Set the description.
         *
         * @param description the parameter description
         * @return 构建器
         */
        public Builder description(String description) {
            this.description = description;
            return this;
        }

        /**
         * Set the required flag.
         *
         * @param isRequired whether the parameter is required
         * @return 构建器
         */
        public Builder isRequired(Boolean isRequired) {
            this.isRequired = isRequired;
            return this;
        }

        /**
         * Set the sort order.
         *
         * @param sortOrder the sort order
         * @return 构建器
         */
        public Builder sortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
            return this;
        }

        /**
         * Build the StrategyParameterDto.
         *
         * @return the StrategyParameterDto
         */
        public StrategyParameterDto build() {
            return new StrategyParameterDto(id, paramName, paramType, defaultValue,
                    minValue, maxValue, description, isRequired, sortOrder);
        }
    }
}
