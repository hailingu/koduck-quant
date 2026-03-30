package com.koduck.dto.ai;

import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
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

    public List<StrategyRecommendation> getRecommendations() {
        return CollectionCopyUtils.copyList(recommendations);
    }

    public void setRecommendations(List<StrategyRecommendation> recommendations) {
        this.recommendations = CollectionCopyUtils.copyList(recommendations);
    }

    public AssetAllocationSuggestion getAssetAllocation() {
        return copyAssetAllocation(assetAllocation);
    }

    public void setAssetAllocation(AssetAllocationSuggestion assetAllocation) {
        this.assetAllocation = copyAssetAllocation(assetAllocation);
    }

    public static Builder builder() {
        return new Builder();
    }

    private static AssetAllocationSuggestion copyAssetAllocation(AssetAllocationSuggestion source) {
        if (source == null) {
            return null;
        }
        return AssetAllocationSuggestion.builder()
                .assetClasses(copyAssetClasses(source.getAssetClasses()))
                .rebalancingSuggestion(source.getRebalancingSuggestion())
                .build();
    }

    private static List<AssetClass> copyAssetClasses(List<AssetClass> source) {
        return CollectionCopyUtils.copyList(source);
    }

    public static final class Builder {

        private String riskProfile;
        private String investmentHorizon;
        private List<StrategyRecommendation> recommendations;
        private AssetAllocationSuggestion assetAllocation;
        private String summary;
        private String disclaimer;
        private LocalDateTime generatedAt;

        public Builder riskProfile(String riskProfile) {
            this.riskProfile = riskProfile;
            return this;
        }

        public Builder investmentHorizon(String investmentHorizon) {
            this.investmentHorizon = investmentHorizon;
            return this;
        }

        public Builder recommendations(List<StrategyRecommendation> recommendations) {
            this.recommendations = CollectionCopyUtils.copyList(recommendations);
            return this;
        }

        public Builder assetAllocation(AssetAllocationSuggestion assetAllocation) {
            this.assetAllocation = copyAssetAllocation(assetAllocation);
            return this;
        }

        public Builder summary(String summary) {
            this.summary = summary;
            return this;
        }

        public Builder disclaimer(String disclaimer) {
            this.disclaimer = disclaimer;
            return this;
        }

        public Builder generatedAt(LocalDateTime generatedAt) {
            this.generatedAt = generatedAt;
            return this;
        }

        public StrategyRecommendResponse build() {
            StrategyRecommendResponse response = new StrategyRecommendResponse();
            response.riskProfile = riskProfile;
            response.investmentHorizon = investmentHorizon;
            response.recommendations = CollectionCopyUtils.copyList(recommendations);
            response.assetAllocation = copyAssetAllocation(assetAllocation);
            response.summary = summary;
            response.disclaimer = disclaimer;
            response.generatedAt = generatedAt;
            return response;
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class StrategyRecommendation {
        private Long strategyId;
        private String strategyName;
        private String strategyType;
        private Integer matchScore;
        private String matchReason;
        private String expectedReturn;
        private String riskLevel;
        private List<String> suitableMarkets;

        public List<String> getSuitableMarkets() {
            return CollectionCopyUtils.copyList(suitableMarkets);
        }

        public void setSuitableMarkets(List<String> suitableMarkets) {
            this.suitableMarkets = CollectionCopyUtils.copyList(suitableMarkets);
        }

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private Long strategyId;
            private String strategyName;
            private String strategyType;
            private Integer matchScore;
            private String matchReason;
            private String expectedReturn;
            private String riskLevel;
            private List<String> suitableMarkets;

            public Builder strategyId(Long strategyId) {
                this.strategyId = strategyId;
                return this;
            }

            public Builder strategyName(String strategyName) {
                this.strategyName = strategyName;
                return this;
            }

            public Builder strategyType(String strategyType) {
                this.strategyType = strategyType;
                return this;
            }

            public Builder matchScore(Integer matchScore) {
                this.matchScore = matchScore;
                return this;
            }

            public Builder matchReason(String matchReason) {
                this.matchReason = matchReason;
                return this;
            }

            public Builder expectedReturn(String expectedReturn) {
                this.expectedReturn = expectedReturn;
                return this;
            }

            public Builder riskLevel(String riskLevel) {
                this.riskLevel = riskLevel;
                return this;
            }

            public Builder suitableMarkets(List<String> suitableMarkets) {
                this.suitableMarkets = CollectionCopyUtils.copyList(suitableMarkets);
                return this;
            }

            public StrategyRecommendation build() {
                StrategyRecommendation recommendation = new StrategyRecommendation();
                recommendation.strategyId = strategyId;
                recommendation.strategyName = strategyName;
                recommendation.strategyType = strategyType;
                recommendation.matchScore = matchScore;
                recommendation.matchReason = matchReason;
                recommendation.expectedReturn = expectedReturn;
                recommendation.riskLevel = riskLevel;
                recommendation.setSuitableMarkets(suitableMarkets);
                return recommendation;
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class AssetAllocationSuggestion {
        private List<AssetClass> assetClasses;
        private String rebalancingSuggestion;

        public List<AssetClass> getAssetClasses() {
            return CollectionCopyUtils.copyList(assetClasses);
        }

        public void setAssetClasses(List<AssetClass> assetClasses) {
            this.assetClasses = CollectionCopyUtils.copyList(assetClasses);
        }

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private List<AssetClass> assetClasses;
            private String rebalancingSuggestion;

            public Builder assetClasses(List<AssetClass> assetClasses) {
                this.assetClasses = CollectionCopyUtils.copyList(assetClasses);
                return this;
            }

            public Builder rebalancingSuggestion(String rebalancingSuggestion) {
                this.rebalancingSuggestion = rebalancingSuggestion;
                return this;
            }

            public AssetAllocationSuggestion build() {
                AssetAllocationSuggestion suggestion = new AssetAllocationSuggestion();
                suggestion.setAssetClasses(assetClasses);
                suggestion.rebalancingSuggestion = rebalancingSuggestion;
                return suggestion;
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssetClass {
        private String type;
        private Integer percentage;
        private String description;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String type;
            private Integer percentage;
            private String description;

            public Builder type(String type) {
                this.type = type;
                return this;
            }

            public Builder percentage(Integer percentage) {
                this.percentage = percentage;
                return this;
            }

            public Builder description(String description) {
                this.description = description;
                return this;
            }

            public AssetClass build() {
                return new AssetClass(type, percentage, description);
            }
        }
    }
}
