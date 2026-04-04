package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Stock daily statistics DTO.
 * Provides aggregated daily trading statistics for a stock.
 *
 * @param symbol the stock symbol
 * @param market the market code
 * @param open 开盘价ing price
 * @param high 最高价est price
 * @param low 最低价est price
 * @param current the current price
 * @param prevClose the previous closing price
 * @param change the price change
 * @param changePercent the price change percentage
 * @param volume the trading volume
 * @param amount the trading amount
 * @param timestamp 时间戳
 * @author Koduck Team
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
        /** Stock symbol. */
        private String symbol;
        /** Market code. */
        private String market;
        /** Opening price. */
        private BigDecimal open;
        /** Highest price. */
        private BigDecimal high;
        /** Lowest price. */
        private BigDecimal low;
        /** Current price. */
        private BigDecimal current;
        /** Previous closing price. */
        private BigDecimal prevClose;
        /** Price change. */
        private BigDecimal change;
        /** Price change percentage. */
        private BigDecimal changePercent;
        /** Trading volume. */
        private Long volume;
        /** Trading amount. */
        private BigDecimal amount;
        /** Timestamp. */
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
