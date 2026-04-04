package com.koduck.dto.portfolio;

import java.math.BigDecimal;

/**
 * 投资组合汇总数据传输对象。
 *
 * @param totalCost the total cost
 * @param totalMarketValue the total market value
 * @param totalPnl the total profit and loss
 * @param totalPnlPercent the total profit and loss percentage
 * @param dailyPnl the daily profit and loss
 * @param dailyPnlPercent the daily profit and loss percentage
 * @author Koduck Team
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
        /** Total cost. */
        private BigDecimal totalCost;
        /** Total market value. */
        private BigDecimal totalMarketValue;
        /** Total profit and loss. */
        private BigDecimal totalPnl;
        /** Total profit and loss percentage. */
        private BigDecimal totalPnlPercent;
        /** Daily profit and loss. */
        private BigDecimal dailyPnl;
        /** Daily profit and loss percentage. */
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
