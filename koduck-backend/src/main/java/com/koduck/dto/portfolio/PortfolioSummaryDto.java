package com.koduck.dto.portfolio;
import java.math.BigDecimal;

/**
 * Portfolio summary DTO.
 */
public record PortfolioSummaryDto(
    BigDecimal totalCost,
    BigDecimal totalMarketValue,
    BigDecimal totalPnl,
    BigDecimal totalPnlPercent,
    BigDecimal dailyPnl,
    BigDecimal dailyPnlPercent
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private BigDecimal totalCost;
        private BigDecimal totalMarketValue;
        private BigDecimal totalPnl;
        private BigDecimal totalPnlPercent;
        private BigDecimal dailyPnl;
        private BigDecimal dailyPnlPercent;
        
        public Builder totalCost(BigDecimal totalCost) {
            this.totalCost = totalCost;
            return this;
        }
        
        public Builder totalMarketValue(BigDecimal totalMarketValue) {
            this.totalMarketValue = totalMarketValue;
            return this;
        }
        
        public Builder totalPnl(BigDecimal totalPnl) {
            this.totalPnl = totalPnl;
            return this;
        }
        
        public Builder totalPnlPercent(BigDecimal totalPnlPercent) {
            this.totalPnlPercent = totalPnlPercent;
            return this;
        }
        
        public Builder dailyPnl(BigDecimal dailyPnl) {
            this.dailyPnl = dailyPnl;
            return this;
        }
        
        public Builder dailyPnlPercent(BigDecimal dailyPnlPercent) {
            this.dailyPnlPercent = dailyPnlPercent;
            return this;
        }
        
        public PortfolioSummaryDto build() {
            return new PortfolioSummaryDto(totalCost, totalMarketValue, totalPnl,
                    totalPnlPercent, dailyPnl, dailyPnlPercent);
        }
    }
}
