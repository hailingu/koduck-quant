package com.koduck.dto.ai;
import java.time.LocalDateTime;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 策略推荐响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class StrategyRecommendResponse {

    /**
     * 风险画像。
     */
    private String riskProfile;

    /**
     * 投资期限。
     */
    private String investmentHorizon;

    /**
     * 策略推荐列表。
     */
    private List<StrategyRecommendation> recommendations;

    /**
     * 资产配置建议。
     */
    private AssetAllocationSuggestion assetAllocation;

    /**
     * 总结。
     */
    private String summary;

    /**
     * 免责声明。
     */
    private String disclaimer;

    /**
     * 生成时间。
     */
    private LocalDateTime generatedAt;

    /**
     * 获取策略推荐列表的副本。
     *
     * @return 策略推荐列表副本
     */
    public List<StrategyRecommendation> getRecommendations() {
        return CollectionCopyUtils.copyList(recommendations);
    }

    /**
     * 设置策略推荐列表。
     *
     * @param recommendations 策略推荐列表
     */
    public void setRecommendations(List<StrategyRecommendation> recommendations) {
        this.recommendations = CollectionCopyUtils.copyList(recommendations);
    }

    /**
     * 获取资产配置建议的副本。
     *
     * @return 资产配置建议副本
     */
    public AssetAllocationSuggestion getAssetAllocation() {
        return copyAssetAllocation(assetAllocation);
    }

    /**
     * 设置资产配置建议。
     *
     * @param assetAllocation 资产配置建议
     */
    public void setAssetAllocation(AssetAllocationSuggestion assetAllocation) {
        this.assetAllocation = copyAssetAllocation(assetAllocation);
    }

    /**
     * 获取 Builder 实例。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * 复制资产配置建议对象。
     *
     * @param source 源对象
     * @return 副本
     */
    private static AssetAllocationSuggestion copyAssetAllocation(
            AssetAllocationSuggestion source
    ) {
        if (source == null) {
            return null;
        }
        return AssetAllocationSuggestion.builder()
                .assetClasses(copyAssetClasses(source.getAssetClasses()))
                .rebalancingSuggestion(source.getRebalancingSuggestion())
                .build();
    }

    /**
     * 复制资产类别列表。
     *
     * @param source 源列表
     * @return 副本
     */
    private static List<AssetClass> copyAssetClasses(List<AssetClass> source) {
        return CollectionCopyUtils.copyList(source);
    }

    /**
     * Builder 类。
     */
    public static final class Builder {

        private String riskProfile;
        private String investmentHorizon;
        private List<StrategyRecommendation> recommendations;
        private AssetAllocationSuggestion assetAllocation;
        private String summary;
        private String disclaimer;
        private LocalDateTime generatedAt;

        /**
         * 设置风险画像。
         *
         * @param riskProfile 风险画像
         * @return Builder 实例
         */
        public Builder riskProfile(String riskProfile) {
            this.riskProfile = riskProfile;
            return this;
        }

        /**
         * 设置投资期限。
         *
         * @param investmentHorizon 投资期限
         * @return Builder 实例
         */
        public Builder investmentHorizon(String investmentHorizon) {
            this.investmentHorizon = investmentHorizon;
            return this;
        }

        /**
         * 设置策略推荐列表。
         *
         * @param recommendations 策略推荐列表
         * @return Builder 实例
         */
        public Builder recommendations(List<StrategyRecommendation> recommendations) {
            this.recommendations = CollectionCopyUtils.copyList(recommendations);
            return this;
        }

        /**
         * 设置资产配置建议。
         *
         * @param assetAllocation 资产配置建议
         * @return Builder 实例
         */
        public Builder assetAllocation(AssetAllocationSuggestion assetAllocation) {
            this.assetAllocation = copyAssetAllocation(assetAllocation);
            return this;
        }

        /**
         * 设置总结。
         *
         * @param summary 总结
         * @return Builder 实例
         */
        public Builder summary(String summary) {
            this.summary = summary;
            return this;
        }

        /**
         * 设置免责声明。
         *
         * @param disclaimer 免责声明
         * @return Builder 实例
         */
        public Builder disclaimer(String disclaimer) {
            this.disclaimer = disclaimer;
            return this;
        }

        /**
         * 设置生成时间。
         *
         * @param generatedAt 生成时间
         * @return Builder 实例
         */
        public Builder generatedAt(LocalDateTime generatedAt) {
            this.generatedAt = generatedAt;
            return this;
        }

        /**
         * 构建响应对象。
         *
         * @return StrategyRecommendResponse 实例
         */
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
     * 策略推荐。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    public static class StrategyRecommendation {

        /**
         * 策略ID。
         */
        private Long strategyId;

        /**
         * 策略名称。
         */
        private String strategyName;

        /**
         * 策略类型。
         */
        private String strategyType;

        /**
         * 匹配分数。
         */
        private Integer matchScore;

        /**
         * 匹配原因。
         */
        private String matchReason;

        /**
         * 预期收益。
         */
        private String expectedReturn;

        /**
         * 风险等级。
         */
        private String riskLevel;

        /**
         * 适用市场列表。
         */
        private List<String> suitableMarkets;

        /**
         * 获取适用市场列表的副本。
         *
         * @return 适用市场列表副本
         */
        public List<String> getSuitableMarkets() {
            return CollectionCopyUtils.copyList(suitableMarkets);
        }

        /**
         * 设置适用市场列表。
         *
         * @param suitableMarkets 适用市场列表
         */
        public void setSuitableMarkets(List<String> suitableMarkets) {
            this.suitableMarkets = CollectionCopyUtils.copyList(suitableMarkets);
        }

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private Long strategyId;
            private String strategyName;
            private String strategyType;
            private Integer matchScore;
            private String matchReason;
            private String expectedReturn;
            private String riskLevel;
            private List<String> suitableMarkets;

            /**
             * 设置策略ID。
             *
             * @param strategyId 策略ID
             * @return Builder 实例
             */
            public Builder strategyId(Long strategyId) {
                this.strategyId = strategyId;
                return this;
            }

            /**
             * 设置策略名称。
             *
             * @param strategyName 策略名称
             * @return Builder 实例
             */
            public Builder strategyName(String strategyName) {
                this.strategyName = strategyName;
                return this;
            }

            /**
             * 设置策略类型。
             *
             * @param strategyType 策略类型
             * @return Builder 实例
             */
            public Builder strategyType(String strategyType) {
                this.strategyType = strategyType;
                return this;
            }

            /**
             * 设置匹配分数。
             *
             * @param matchScore 匹配分数
             * @return Builder 实例
             */
            public Builder matchScore(Integer matchScore) {
                this.matchScore = matchScore;
                return this;
            }

            /**
             * 设置匹配原因。
             *
             * @param matchReason 匹配原因
             * @return Builder 实例
             */
            public Builder matchReason(String matchReason) {
                this.matchReason = matchReason;
                return this;
            }

            /**
             * 设置预期收益。
             *
             * @param expectedReturn 预期收益
             * @return Builder 实例
             */
            public Builder expectedReturn(String expectedReturn) {
                this.expectedReturn = expectedReturn;
                return this;
            }

            /**
             * 设置风险等级。
             *
             * @param riskLevel 风险等级
             * @return Builder 实例
             */
            public Builder riskLevel(String riskLevel) {
                this.riskLevel = riskLevel;
                return this;
            }

            /**
             * 设置适用市场列表。
             *
             * @param suitableMarkets 适用市场列表
             * @return Builder 实例
             */
            public Builder suitableMarkets(List<String> suitableMarkets) {
                this.suitableMarkets = CollectionCopyUtils.copyList(suitableMarkets);
                return this;
            }

            /**
             * 构建策略推荐对象。
             *
             * @return StrategyRecommendation 实例
             */
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
     * 资产配置建议。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    public static class AssetAllocationSuggestion {

        /**
         * 资产类别列表。
         */
        private List<AssetClass> assetClasses;

        /**
         * 再平衡建议。
         */
        private String rebalancingSuggestion;

        /**
         * 获取资产类别列表的副本。
         *
         * @return 资产类别列表副本
         */
        public List<AssetClass> getAssetClasses() {
            return CollectionCopyUtils.copyList(assetClasses);
        }

        /**
         * 设置资产类别列表。
         *
         * @param assetClasses 资产类别列表
         */
        public void setAssetClasses(List<AssetClass> assetClasses) {
            this.assetClasses = CollectionCopyUtils.copyList(assetClasses);
        }

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private List<AssetClass> assetClasses;
            private String rebalancingSuggestion;

            /**
             * 设置资产类别列表。
             *
             * @param assetClasses 资产类别列表
             * @return Builder 实例
             */
            public Builder assetClasses(List<AssetClass> assetClasses) {
                this.assetClasses = CollectionCopyUtils.copyList(assetClasses);
                return this;
            }

            /**
             * 设置再平衡建议。
             *
             * @param rebalancingSuggestion 再平衡建议
             * @return Builder 实例
             */
            public Builder rebalancingSuggestion(String rebalancingSuggestion) {
                this.rebalancingSuggestion = rebalancingSuggestion;
                return this;
            }

            /**
             * 构建资产配置建议对象。
             *
             * @return AssetAllocationSuggestion 实例
             */
            public AssetAllocationSuggestion build() {
                AssetAllocationSuggestion suggestion = new AssetAllocationSuggestion();
                suggestion.setAssetClasses(assetClasses);
                suggestion.rebalancingSuggestion = rebalancingSuggestion;
                return suggestion;
            }
        }
    }

    /**
     * 资产类别。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssetClass {

        /**
         * 类型。
         */
        private String type;

        /**
         * 百分比。
         */
        private Integer percentage;

        /**
         * 描述。
         */
        private String description;

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private String type;
            private Integer percentage;
            private String description;

            /**
             * 设置类型。
             *
             * @param type 类型
             * @return Builder 实例
             */
            public Builder type(String type) {
                this.type = type;
                return this;
            }

            /**
             * 设置百分比。
             *
             * @param percentage 百分比
             * @return Builder 实例
             */
            public Builder percentage(Integer percentage) {
                this.percentage = percentage;
                return this;
            }

            /**
             * 设置描述。
             *
             * @param description 描述
             * @return Builder 实例
             */
            public Builder description(String description) {
                this.description = description;
                return this;
            }

            /**
             * 构建资产类别对象。
             *
             * @return AssetClass 实例
             */
            public AssetClass build() {
                return new AssetClass(type, percentage, description);
            }
        }
    }
}
