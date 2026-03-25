package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 *  DTO
 * 
 *
 * @param symbol        
 * @param name          
 * @param price         
 * @param change        
 * @param changePercent 
 * @param open          
 * @param high          
 * @param low           
 * @param prevClose     
 * @param volume        （）
 * @param amount        （）
 * @param timestamp     
 */
public record MarketIndexDto(
    String symbol,
    String name,
    String type,
    BigDecimal price,
    BigDecimal change,
    BigDecimal changePercent,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal prevClose,
    Long volume,
    BigDecimal amount,
    Instant timestamp
) {
    public MarketIndexDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String symbol;
        private String name;
        private String type;
        private BigDecimal price;
        private BigDecimal change;
        private BigDecimal changePercent;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal prevClose;
        private Long volume;
        private BigDecimal amount;
        private Instant timestamp;
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder name(String name) {
            this.name = name;
            return this;
        }
        
        public Builder type(String type) {
            this.type = type;
            return this;
        }
        
        public Builder price(BigDecimal price) {
            this.price = price;
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
        
        public Builder prevClose(BigDecimal prevClose) {
            this.prevClose = prevClose;
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
        
        public MarketIndexDto build() {
            return new MarketIndexDto(
                symbol, name, type, price, change, changePercent,
                open, high, low, prevClose, volume, amount, timestamp
            );
        }
    }
}