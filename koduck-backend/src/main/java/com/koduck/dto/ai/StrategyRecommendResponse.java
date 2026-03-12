package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyRecommendResponse {

    private String riskProfile;
    private String investmentHorizon;

    // 
    private List<StrategyRecommendation> recommendations;

    // 
    private AssetAllocationSuggestion assetAllocation;

    // AI 
    private String summary;
    private String disclaimer;

    private LocalDateTime generatedAt;

    /**
     * 
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
     * 
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
     * 
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
