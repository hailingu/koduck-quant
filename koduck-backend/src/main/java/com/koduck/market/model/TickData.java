package com.koduck.market.model;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Real-time tick data model.
 * Represents a single trade/tick in the market.
 */
public record TickData(
    String symbol,

    String market,

    Instant timestamp,

    BigDecimal price,

    BigDecimal change,

    BigDecimal changePercent,

    Long volume,

    BigDecimal amount,

    BigDecimal bidPrice,

    Long bidVolume,

    BigDecimal askPrice,

    Long askVolume,

    BigDecimal dayHigh,

    BigDecimal dayLow,

    BigDecimal open,

    BigDecimal prevClose
) {
    
    /**
     * Check if price is rising
     */
    public boolean isRising() {
        return change != null && change.compareTo(BigDecimal.ZERO) > 0;
    }
    
    /**
     * Check if price is falling
     */
    public boolean isFalling() {
        return change != null && change.compareTo(BigDecimal.ZERO) < 0;
    }
    
    /**
     * Get spread between ask and bid
     */
    public BigDecimal getSpread() {
        if (askPrice == null || bidPrice == null) {
            return BigDecimal.ZERO;
        }
        return askPrice.subtract(bidPrice);
    }
    
    /**
     * Builder for TickData
     */
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String symbol;
        private String market;
        private Instant timestamp;
        private BigDecimal price;
        private BigDecimal change;
        private BigDecimal changePercent;
        private Long volume;
        private BigDecimal amount;
        private BigDecimal bidPrice;
        private Long bidVolume;
        private BigDecimal askPrice;
        private Long askVolume;
        private BigDecimal dayHigh;
        private BigDecimal dayLow;
        private BigDecimal open;
        private BigDecimal prevClose;
        
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
        
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }
        
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
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
        
        public Builder dayHigh(BigDecimal dayHigh) {
            this.dayHigh = dayHigh;
            return this;
        }
        
        public Builder dayLow(BigDecimal dayLow) {
            this.dayLow = dayLow;
            return this;
        }
        
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }
        
        public Builder prevClose(BigDecimal prevClose) {
            this.prevClose = prevClose;
            return this;
        }
        
        public TickData build() {
            return new TickData(symbol, market, timestamp, price, change, changePercent,
                              volume, amount, bidPrice, bidVolume, askPrice, askVolume,
                              dayHigh, dayLow, open, prevClose);
        }
    }
}
