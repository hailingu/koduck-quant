package com.koduck.dto.portfolio;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Trade record DTO.
 */
public record TradeDto(
    Long id,
    String market,
    String symbol,
    String name,
    String tradeType,
    BigDecimal quantity,
    BigDecimal price,
    BigDecimal amount,
    LocalDateTime tradeTime,
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
        private String tradeType;
        private BigDecimal quantity;
        private BigDecimal price;
        private BigDecimal amount;
        private LocalDateTime tradeTime;
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
        
        public Builder tradeType(String tradeType) {
            this.tradeType = tradeType;
            return this;
        }
        
        public Builder quantity(BigDecimal quantity) {
            this.quantity = quantity;
            return this;
        }
        
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }
        
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }
        
        public Builder tradeTime(LocalDateTime tradeTime) {
            this.tradeTime = tradeTime;
            return this;
        }
        
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        
        public TradeDto build() {
            return new TradeDto(id, market, symbol, name, tradeType, quantity, price,
                    amount, tradeTime, createdAt);
        }
    }
}
