package com.koduck.dto.market;

import java.math.BigDecimal;

/**
 * K-line (candlestick) data DTO.
 */
public record KlineDataDto(
    Long timestamp,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal close,
    Long volume,
    BigDecimal amount
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long timestamp;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;
        private Long volume;
        private BigDecimal amount;
        
        public Builder timestamp(Long timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }
        
        public Builder high(BigDecimal high) {
            this.high = high;
            return this;
        }
        
        public Builder low(BigDecimal low) {
            this.low = low;
            return this;
        }
        
        public Builder close(BigDecimal close) {
            this.close = close;
            return this;
        }
        
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }
        
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }
        
        public KlineDataDto build() {
            return new KlineDataDto(timestamp, open, high, low, close, volume, amount);
        }
    }
}
