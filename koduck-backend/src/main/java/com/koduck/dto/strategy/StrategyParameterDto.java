package com.koduck.dto.strategy;
import java.math.BigDecimal;

/**
 * Strategy parameter DTO.
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
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private String paramName;
        private String paramType;
        private String defaultValue;
        private BigDecimal minValue;
        private BigDecimal maxValue;
        private String description;
        private Boolean isRequired;
        private Integer sortOrder;
        
        public Builder id(Long id) {
            this.id = id;
            return this;
        }
        
        public Builder paramName(String paramName) {
            this.paramName = paramName;
            return this;
        }
        
        public Builder paramType(String paramType) {
            this.paramType = paramType;
            return this;
        }
        
        public Builder defaultValue(String defaultValue) {
            this.defaultValue = defaultValue;
            return this;
        }
        
        public Builder minValue(BigDecimal minValue) {
            this.minValue = minValue;
            return this;
        }
        
        public Builder maxValue(BigDecimal maxValue) {
            this.maxValue = maxValue;
            return this;
        }
        
        public Builder description(String description) {
            this.description = description;
            return this;
        }
        
        public Builder isRequired(Boolean isRequired) {
            this.isRequired = isRequired;
            return this;
        }
        
        public Builder sortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
            return this;
        }
        
        public StrategyParameterDto build() {
            return new StrategyParameterDto(id, paramName, paramType, defaultValue,
                    minValue, maxValue, description, isRequired, sortOrder);
        }
    }
}
