package com.koduck.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 收益趋势 DTO
 */
public record ProfitTrendDto(
    List<DailyProfit> data
) {
    
    public record DailyProfit(
        LocalDate date,           // 日期
        BigDecimal profit,        // 当日收益
        BigDecimal profitRate,    // 当日收益率
        BigDecimal totalAssets    // 当日总资产
    ) {
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private List<DailyProfit> data;
        
        public Builder data(List<DailyProfit> data) {
            this.data = data;
            return this;
        }
        
        public ProfitTrendDto build() {
            return new ProfitTrendDto(data);
        }
    }
}
