package com.koduck.market.model;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * Unified K-line data model across all markets.
 * This is the standard format that all providers must convert their data to.
 */
public record KlineData(
    String symbol,

    String market,

    Instant timestamp,

    BigDecimal open,

    BigDecimal high,

    BigDecimal low,

    BigDecimal close,

    Long volume,

    BigDecimal amount,

    String timeframe
) {
    
    public KlineData {
        if (amount == null) {
            amount = BigDecimal.ZERO;
        }
    }
    
    /**
     * Calculate price change
     */
    public BigDecimal getPriceChange() {
        return close.subtract(open);
    }
    
    /**
     * Calculate price change percentage
     */
    public BigDecimal getPriceChangePercent() {
        if (open.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return close.subtract(open)
                   .divide(open, 4, RoundingMode.HALF_UP)
                   .multiply(BigDecimal.valueOf(100));
    }
    
    /**
     * Check if this is a rising k-line
     */
    public boolean isRising() {
        return close.compareTo(open) >= 0;
    }
    
    /**
     * Builder for KlineData
     */
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String symbol;
        private String market;
        private Instant timestamp;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;
        private Long volume;
        private BigDecimal amount;
        private String timeframe;
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder market(String market) {
            this.market = market;
            return this;
        }
        
        public Builder timestamp(Instant timestamp) {
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
        
        public Builder timeframe(String timeframe) {
            this.timeframe = timeframe;
            return this;
        }
        
        public KlineData build() {
            return new KlineData(symbol, market, timestamp, open, high, low, 
                                close, volume, amount, timeframe);
        }
    }
}
