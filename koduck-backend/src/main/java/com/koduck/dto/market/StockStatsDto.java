package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Stock daily statistics DTO.
 * Provides aggregated daily trading statistics for a stock.
 */
public record StockStatsDto(
    String symbol,
    String market,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal current,
    BigDecimal prevClose,
    BigDecimal change,
    BigDecimal changePercent,
    Long volume,
    BigDecimal amount,
    Instant timestamp
) {
    public StockStatsDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }
    
    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String symbol;
        private String market;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal current;
        private BigDecimal prevClose;
        private BigDecimal change;
        private BigDecimal changePercent;
        private Long volume;
        private BigDecimal amount;
        private Instant timestamp;
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder market(String market) {
            this.market = market;
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
        
        public Builder current(BigDecimal current) {
            this.current = current;
            return this;
        }
        
        public Builder prevClose(BigDecimal prevClose) {
            this.prevClose = prevClose;
            return this;
        }
        
        public Builder change(BigDecimal change) {
            this.change = change;
            return this;
        }
        
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
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
        
        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public StockStatsDto build() {
            return new StockStatsDto(
                symbol, market, open, high, low, current, prevClose,
                change, changePercent, volume, amount, timestamp
            );
        }
    }
}
