package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Stock industry metadata DTO.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record StockIndustryDto(
    String symbol,
    String name,
    String industry,
    String sector,
    String subIndustry,
    String board
) {
    public StockIndustryDto {
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
        private String industry;
        private String sector;
        private String subIndustry;
        private String board;

        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder industry(String industry) {
            this.industry = industry;
            return this;
        }

        public Builder sector(String sector) {
            this.sector = sector;
            return this;
        }

        public Builder subIndustry(String subIndustry) {
            this.subIndustry = subIndustry;
            return this;
        }

        public Builder board(String board) {
            this.board = board;
            return this;
        }

        public StockIndustryDto build() {
            return new StockIndustryDto(symbol, name, industry, sector, subIndustry, board);
        }
    }
}