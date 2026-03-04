package com.koduck.dto.dashboard;

import java.math.BigDecimal;

/**
 * 仪表盘资产概览 DTO
 */
public record DashboardSummaryDto(
    BigDecimal totalAssets,        // 总资产
    BigDecimal totalProfit,        // 累计收益
    BigDecimal profitRate,         // 收益率
    BigDecimal todayProfit,        // 今日收益
    BigDecimal todayProfitRate,    // 今日收益率
    Integer positionCount,         // 持仓数量
    Integer watchlistCount,        // 自选股数量
    Integer strategyCount          // 策略数量
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private BigDecimal totalAssets;
        private BigDecimal totalProfit;
        private BigDecimal profitRate;
        private BigDecimal todayProfit;
        private BigDecimal todayProfitRate;
        private Integer positionCount;
        private Integer watchlistCount;
        private Integer strategyCount;
        
        public Builder totalAssets(BigDecimal totalAssets) {
            this.totalAssets = totalAssets;
            return this;
        }
        
        public Builder totalProfit(BigDecimal totalProfit) {
            this.totalProfit = totalProfit;
            return this;
        }
        
        public Builder profitRate(BigDecimal profitRate) {
            this.profitRate = profitRate;
            return this;
        }
        
        public Builder todayProfit(BigDecimal todayProfit) {
            this.todayProfit = todayProfit;
            return this;
        }
        
        public Builder todayProfitRate(BigDecimal todayProfitRate) {
            this.todayProfitRate = todayProfitRate;
            return this;
        }
        
        public Builder positionCount(Integer positionCount) {
            this.positionCount = positionCount;
            return this;
        }
        
        public Builder watchlistCount(Integer watchlistCount) {
            this.watchlistCount = watchlistCount;
            return this;
        }
        
        public Builder strategyCount(Integer strategyCount) {
            this.strategyCount = strategyCount;
            return this;
        }
        
        public DashboardSummaryDto build() {
            return new DashboardSummaryDto(totalAssets, totalProfit, profitRate,
                    todayProfit, todayProfitRate, positionCount, watchlistCount, strategyCount);
        }
    }
}
