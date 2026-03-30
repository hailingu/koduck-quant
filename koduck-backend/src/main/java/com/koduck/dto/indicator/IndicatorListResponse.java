package com.koduck.dto.indicator;

import com.koduck.util.CollectionCopyUtils;
import java.util.List;

/**
 * Available indicators list response.
 */
public record IndicatorListResponse(
    List<IndicatorInfo> indicators
) {
    public IndicatorListResponse {
        indicators = CollectionCopyUtils.copyList(indicators);
    }

    @Override
    public List<IndicatorInfo> indicators() {
        return CollectionCopyUtils.copyList(indicators);
    }
    
    public record IndicatorInfo(
        String code,
        String name,
        String description,
        List<Integer> defaultPeriods,
        String category
    ) {
        public IndicatorInfo {
            defaultPeriods = CollectionCopyUtils.copyList(defaultPeriods);
        }
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private List<IndicatorInfo> indicators;
        
        public Builder indicators(List<IndicatorInfo> indicators) {
            this.indicators = CollectionCopyUtils.copyList(indicators);
            return this;
        }
        
        public IndicatorListResponse build() {
            return new IndicatorListResponse(indicators);
        }
    }
}
