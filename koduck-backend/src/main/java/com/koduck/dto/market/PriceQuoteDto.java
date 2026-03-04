package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Real-time price quote DTO.
 */
public record PriceQuoteDto(
    String symbol,
    String name,
    BigDecimal price,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal prevClose,
    Long volume,
    BigDecimal amount,
    BigDecimal change,
    BigDecimal changePercent,
    BigDecimal bidPrice,
    Long bidVolume,
    BigDecimal askPrice,
    Long askVolume,
    Instant timestamp
) {
    public PriceQuoteDto {
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
        private String name;
        private BigDecimal price;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal prevClose;
        private Long volume;
        private BigDecimal amount;
        private BigDecimal change;
        private BigDecimal changePercent;
        private BigDecimal bidPrice;
        private Long bidVolume;
        private BigDecimal askPrice;
        private Long askVolume;
        private Instant timestamp;
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder name(String name) {
            this.name = name;
            return this;
        }
        
        public Builder price(BigDecimal price) {
            this.price = price;
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
        
        public Builder change(BigDecimal change) {
            this.change = change;
            return this;
        }
        
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }
        
        public Builder bidPrice(BigDecimal bidPrice) {
            this.bidPrice = bidPrice;
            return this;
        }
        
        public Builder bidVolume(Long bidVolume) {
            this.bidVolume = bidVolume;
            return this;
        }
        
        public Builder askPrice(BigDecimal askPrice) {
            this.askPrice = askPrice;
            return this;
        }
        
        public Builder askVolume(Long askVolume) {
            this.askVolume = askVolume;
            return this;
        }
        
        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public PriceQuoteDto build() {
            return new PriceQuoteDto(
                symbol, name, price, open, high, low, prevClose,
                volume, amount, change, changePercent,
                bidPrice, bidVolume, askPrice, askVolume, timestamp
            );
        }
    }
}
