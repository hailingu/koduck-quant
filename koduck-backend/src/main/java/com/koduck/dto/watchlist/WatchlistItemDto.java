package com.koduck.dto.watchlist;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Watchlist item DTO with real-time price.
 */
public record WatchlistItemDto(
    Long id,
    String market,
    String symbol,
    String name,
    Integer sortOrder,
    String notes,
    BigDecimal currentPrice,
    BigDecimal changePercent,
    LocalDateTime createdAt
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private String market;
        private String symbol;
        private String name;
        private Integer sortOrder;
        private String notes;
        private BigDecimal currentPrice;
        private BigDecimal changePercent;
        private LocalDateTime createdAt;
        
        public Builder id(Long id) {
            this.id = id;
            return this;
        }
        
        public Builder market(String market) {
            this.market = market;
            return this;
        }
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder name(String name) {
            this.name = name;
            return this;
        }
        
        public Builder sortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
            return this;
        }
        
        public Builder notes(String notes) {
            this.notes = notes;
            return this;
        }
        
        public Builder currentPrice(BigDecimal currentPrice) {
            this.currentPrice = currentPrice;
            return this;
        }
        
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }
        
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        
        public WatchlistItemDto build() {
            return new WatchlistItemDto(id, market, symbol, name, sortOrder, notes, 
                                       currentPrice, changePercent, createdAt);
        }
    }
}
