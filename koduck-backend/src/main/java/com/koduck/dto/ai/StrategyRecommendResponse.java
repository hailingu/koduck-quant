package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 策略推荐响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyRecommendResponse {

    private String riskProfile;
    private String investmentHorizon;

    // 推荐策略列表
    private List<StrategyRecommendation> recommendations;

    // 资产配置建议
    private AssetAllocationSuggestion assetAllocation;

    // AI 建议总结
    private String summary;
    private String disclaimer;

    private LocalDateTime generatedAt;

    /**
     * 策略推荐
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StrategyRecommendation {
        private Long strategyId;
        private String strategyName;
        private String strategyType;
        private Integer matchScore;
        private String matchReason;
        private String expectedReturn;
        private String riskLevel;
        private List<String> suitableMarkets;
    }

    /**
     * 资产配置建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssetAllocationSuggestion {
        private List<AssetClass> assetClasses;
        private String rebalancingSuggestion;
    }

    /**
     * 资产类别
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssetClass {
        private String type;
        private Integer percentage;
        private String description;
    }
}
