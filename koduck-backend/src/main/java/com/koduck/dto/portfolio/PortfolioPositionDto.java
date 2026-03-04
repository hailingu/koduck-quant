package com.koduck.dto.portfolio;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Portfolio position DTO with calculated fields.
 */
public record PortfolioPositionDto(
    Long id,
    String market,
    String symbol,
    String name,
    BigDecimal quantity,
    BigDecimal avgCost,
    BigDecimal currentPrice,
    BigDecimal marketValue,
    BigDecimal pnl,
    BigDecimal pnlPercent,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private String market;
        private String symbol;
        private String name;
        private BigDecimal quantity;
        private BigDecimal avgCost;
        private BigDecimal currentPrice;
        private BigDecimal marketValue;
        private BigDecimal pnl;
        private BigDecimal pnlPercent;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        
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
        
        public Builder quantity(BigDecimal quantity) {
            this.quantity = quantity;
            return this;
        }
        
        public Builder avgCost(BigDecimal avgCost) {
            this.avgCost = avgCost;
            return this;
        }
        
        public Builder currentPrice(BigDecimal currentPrice) {
            this.currentPrice = currentPrice;
            return this;
        }
        
        public Builder marketValue(BigDecimal marketValue) {
            this.marketValue = marketValue;
            return this;
        }
        
        public Builder pnl(BigDecimal pnl) {
            this.pnl = pnl;
            return this;
        }
        
        public Builder pnlPercent(BigDecimal pnlPercent) {
            this.pnlPercent = pnlPercent;
            return this;
        }
        
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }
        
        public PortfolioPositionDto build() {
            return new PortfolioPositionDto(id, market, symbol, name, quantity, avgCost,
                    currentPrice, marketValue, pnl, pnlPercent, createdAt, updatedAt);
        }
    }
}
