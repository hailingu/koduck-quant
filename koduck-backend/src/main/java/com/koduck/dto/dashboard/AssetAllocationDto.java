package com.koduck.dto.dashboard;

import java.math.BigDecimal;
import java.util.List;

/**
 * 持仓分布 DTO
 */
public record AssetAllocationDto(
    List<MarketAllocation> byMarket,      // 按市场分布
    List<PositionAllocation> topPositions //  top 持仓
) {
    
    public record MarketAllocation(
        String market,                    // 市场代码
        String marketName,                // 市场名称
        BigDecimal value,                 // 市值
        BigDecimal percentage             // 占比
    ) {
    }
    
    public record PositionAllocation(
        String symbol,                    // 股票代码
        String name,                      // 股票名称
        BigDecimal marketValue,           // 市值
        BigDecimal percentage,            // 占比
        BigDecimal profit,                // 盈亏
        BigDecimal profitRate             // 盈亏率
    ) {
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private List<MarketAllocation> byMarket;
        private List<PositionAllocation> topPositions;
        
        public Builder byMarket(List<MarketAllocation> byMarket) {
            this.byMarket = byMarket;
            return this;
        }
        
        public Builder topPositions(List<PositionAllocation> topPositions) {
            this.topPositions = topPositions;
            return this;
        }
        
        public AssetAllocationDto build() {
            return new AssetAllocationDto(byMarket, topPositions);
        }
    }
}
