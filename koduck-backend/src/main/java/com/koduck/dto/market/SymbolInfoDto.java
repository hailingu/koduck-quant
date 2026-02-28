package com.koduck.dto.market;

import java.math.BigDecimal;

/**
 * Stock symbol information DTO.
 */
public record SymbolInfoDto(
    String symbol,
    String name,
    String market,
    BigDecimal price,
    BigDecimal changePercent,
    Long volume,
    BigDecimal amount
) {
    public SymbolInfoDto {
        // Compact constructor for validation
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }
    
    // Builder pattern for easier construction
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private String symbol;
        private String name;
        private String market;
        private BigDecimal price;
        private BigDecimal changePercent;
        private Long volume;
        private BigDecimal amount;
        
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }
        
        public Builder name(String name) {
            this.name = name;
            return this;
        }
        
        public Builder market(String market) {
            this.market = market;
            return this;
        }
        
        public Builder price(BigDecimal price) {
            this.price = price;
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
        
        public SymbolInfoDto build() {
            return new SymbolInfoDto(symbol, name, market, price, changePercent, volume, amount);
        }
    }
}
