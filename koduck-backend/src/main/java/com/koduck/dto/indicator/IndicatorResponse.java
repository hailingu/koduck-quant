package com.koduck.dto.indicator;

import com.koduck.util.CollectionCopyUtils;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Technical indicator response DTO.
 */
public record IndicatorResponse(
    String symbol,
    String market,
    String indicator,
    Integer period,
    Map<String, BigDecimal> values,
    String trend,
    LocalDateTime timestamp
) {
    public IndicatorResponse {
        values = CollectionCopyUtils.copyMap(values);
    }

    @Override
    public Map<String, BigDecimal> values() {
        return CollectionCopyUtils.copyMap(values);
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String symbol;
        private String market;
        private String indicator;
        private Integer period;
        private Map<String, BigDecimal> values;
        private String trend;
        private LocalDateTime timestamp;
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder market(String market) {
            this.market = market;
            return this;
        }
        
        public Builder indicator(String indicator) {
            this.indicator = indicator;
            return this;
        }
        
        public Builder period(Integer period) {
            this.period = period;
            return this;
        }
        
        public Builder values(Map<String, BigDecimal> values) {
            this.values = CollectionCopyUtils.copyMap(values);
            return this;
        }
        
        public Builder trend(String trend) {
            this.trend = trend;
            return this;
        }
        
        public Builder timestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public IndicatorResponse build() {
            return new IndicatorResponse(symbol, market, indicator, period, values, trend, timestamp);
        }
    }
}
