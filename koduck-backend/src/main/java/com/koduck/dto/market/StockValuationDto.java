package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.math.BigDecimal;

/**
 * Stock valuation metrics DTO.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record StockValuationDto(
    String symbol,
    String name,
    BigDecimal peTtm,
    BigDecimal pb,
    BigDecimal psTtm,
    BigDecimal marketCap,
    BigDecimal floatMarketCap,
    BigDecimal totalShares,
    BigDecimal floatShares,
    BigDecimal floatRatio,
    BigDecimal turnoverRate
) {
    public StockValuationDto {
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
        private BigDecimal peTtm;
        private BigDecimal pb;
        private BigDecimal psTtm;
        private BigDecimal marketCap;
        private BigDecimal floatMarketCap;
        private BigDecimal totalShares;
        private BigDecimal floatShares;
        private BigDecimal floatRatio;
        private BigDecimal turnoverRate;

        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder peTtm(BigDecimal peTtm) {
            this.peTtm = peTtm;
            return this;
        }

        public Builder pb(BigDecimal pb) {
            this.pb = pb;
            return this;
        }

        public Builder psTtm(BigDecimal psTtm) {
            this.psTtm = psTtm;
            return this;
        }

        public Builder marketCap(BigDecimal marketCap) {
            this.marketCap = marketCap;
            return this;
        }

        public Builder floatMarketCap(BigDecimal floatMarketCap) {
            this.floatMarketCap = floatMarketCap;
            return this;
        }

        public Builder totalShares(BigDecimal totalShares) {
            this.totalShares = totalShares;
            return this;
        }

        public Builder floatShares(BigDecimal floatShares) {
            this.floatShares = floatShares;
            return this;
        }

        public Builder floatRatio(BigDecimal floatRatio) {
            this.floatRatio = floatRatio;
            return this;
        }

        public Builder turnoverRate(BigDecimal turnoverRate) {
            this.turnoverRate = turnoverRate;
            return this;
        }

        public StockValuationDto build() {
            return new StockValuationDto(
                symbol,
                name,
                peTtm,
                pb,
                psTtm,
                marketCap,
                floatMarketCap,
                totalShares,
                floatShares,
                floatRatio,
                turnoverRate
            );
        }
    }
}