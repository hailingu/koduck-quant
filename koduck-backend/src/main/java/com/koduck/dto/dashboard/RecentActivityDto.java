package com.koduck.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 最近动态 DTO
 */
public record RecentActivityDto(
    List<ActivityItem> activities
) {
    
    public record ActivityItem(
        Long id,                      // 活动ID
        String type,                  // 类型: TRADE, PRICE_ALERT, STRATEGY_SIGNAL
        String title,                 // 标题
        String description,           // 描述
        String symbol,                // 股票代码
        BigDecimal value,             // 数值（如交易金额）
        LocalDateTime createdAt       // 时间
    ) {
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private List<ActivityItem> activities;
        
        public Builder activities(List<ActivityItem> activities) {
            this.activities = activities;
            return this;
        }
        
        public RecentActivityDto build() {
            return new RecentActivityDto(activities);
        }
    }
}
