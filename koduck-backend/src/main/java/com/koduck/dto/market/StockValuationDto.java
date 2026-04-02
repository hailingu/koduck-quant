package com.koduck.dto.market;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Stock valuation metrics DTO.
 *
 * @param symbol the symbol
 * @param name the name
 * @param peTtm the PE TTM
 * @param pb the PB
 * @param psTtm the PS TTM
 * @param marketCap the market cap
 * @param floatMarketCap the float market cap
 * @param totalShares the total shares
 * @param floatShares the float shares
 * @param floatRatio the float ratio
 * @param turnoverRate the turnover rate
 * @author koduck
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
        /** Symbol. */
        private String symbol;
        /** Name. */
        private String name;
        /** PE TTM. */
        private BigDecimal peTtm;
        /** PB. */
        private BigDecimal pb;
        /** PS TTM. */
        private BigDecimal psTtm;
        /** Market cap. */
        private BigDecimal marketCap;
        /** Float market cap. */
        private BigDecimal floatMarketCap;
        /** Total shares. */
        private BigDecimal totalShares;
        /** Float shares. */
        private BigDecimal floatShares;
        /** Float ratio. */
        private BigDecimal floatRatio;
        /** Turnover rate. */
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