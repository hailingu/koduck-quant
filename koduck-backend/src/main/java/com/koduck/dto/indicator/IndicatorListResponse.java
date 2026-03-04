package com.koduck.dto.indicator;

import java.util.List;

/**
 * Available indicators list response.
 */
public record IndicatorListResponse(
    List<IndicatorInfo> indicators
) {
    
    public record IndicatorInfo(
        String code,
        String name,
        String description,
        List<Integer> defaultPeriods,
        String category
    ) {}
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private List<IndicatorInfo> indicators;
        
        public Builder indicators(List<IndicatorInfo> indicators) {
            this.indicators = indicators;
            return this;
        }
        
        public IndicatorListResponse build() {
            return new IndicatorListResponse(indicators);
        }
    }
}
