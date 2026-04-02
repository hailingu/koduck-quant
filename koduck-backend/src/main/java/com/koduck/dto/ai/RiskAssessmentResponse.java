package com.koduck.dto.ai;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

/**
 * 风险评估响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class RiskAssessmentResponse {

    /**
     * 投资组合ID。
     */
    private Long portfolioId;

    /**
     * 整体风险评分。
     */
    private Integer overallRiskScore;

    /**
     * 整体风险等级。
     */
    private String overallRiskLevel;

    /**
     * 风险等级描述。
     */
    private String riskLevelDescription;

    /**
     * 风险细分。
     */
    private RiskBreakdown riskBreakdown;

    /**
     * 风险指标列表。
     */
    private List<RiskMetric> metrics;

    /**
     * 风险警报列表。
     */
    private List<RiskAlert> alerts;

    /**
     * 风险管理建议列表。
     */
    private List<RiskManagementSuggestion> suggestions;

    /**
     * 生成时间。
     */
    private LocalDateTime generatedAt;

    /**
     * 获取风险细分的副本。
     *
     * @return 风险细分副本
     */
    public RiskBreakdown getRiskBreakdown() {
        return copyRiskBreakdown(riskBreakdown);
    }

    /**
     * 设置风险细分。
     *
     * @param riskBreakdown 风险细分
     */
    public void setRiskBreakdown(RiskBreakdown riskBreakdown) {
        this.riskBreakdown = copyRiskBreakdown(riskBreakdown);
    }

    /**
     * 获取风险指标列表的副本。
     *
     * @return 风险指标列表副本
     */
    public List<RiskMetric> getMetrics() {
        return CollectionCopyUtils.copyList(metrics);
    }

    /**
     * 设置风险指标列表。
     *
     * @param metrics 风险指标列表
     */
    public void setMetrics(List<RiskMetric> metrics) {
        this.metrics = CollectionCopyUtils.copyList(metrics);
    }

    /**
     * 获取风险警报列表的副本。
     *
     * @return 风险警报列表副本
     */
    public List<RiskAlert> getAlerts() {
        return CollectionCopyUtils.copyList(alerts);
    }

    /**
     * 设置风险警报列表。
     *
     * @param alerts 风险警报列表
     */
    public void setAlerts(List<RiskAlert> alerts) {
        this.alerts = CollectionCopyUtils.copyList(alerts);
    }

    /**
     * 获取风险管理建议列表的副本。
     *
     * @return 风险管理建议列表副本
     */
    public List<RiskManagementSuggestion> getSuggestions() {
        return CollectionCopyUtils.copyList(suggestions);
    }

    /**
     * 设置风险管理建议列表。
     *
     * @param suggestions 风险管理建议列表
     */
    public void setSuggestions(List<RiskManagementSuggestion> suggestions) {
        this.suggestions = CollectionCopyUtils.copyList(suggestions);
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

        private Long portfolioId;
        private Integer overallRiskScore;
        private String overallRiskLevel;
        private String riskLevelDescription;
        private RiskBreakdown riskBreakdown;
        private List<RiskMetric> metrics;
        private List<RiskAlert> alerts;
        private List<RiskManagementSuggestion> suggestions;
        private LocalDateTime generatedAt;

        /**
         * 设置投资组合ID。
         *
         * @param portfolioId 投资组合ID
         * @return Builder 实例
         */
        public Builder portfolioId(Long portfolioId) {
            this.portfolioId = portfolioId;
            return this;
        }

        /**
         * 设置整体风险评分。
         *
         * @param overallRiskScore 整体风险评分
         * @return Builder 实例
         */
        public Builder overallRiskScore(Integer overallRiskScore) {
            this.overallRiskScore = overallRiskScore;
            return this;
        }

        /**
         * 设置整体风险等级。
         *
         * @param overallRiskLevel 整体风险等级
         * @return Builder 实例
         */
        public Builder overallRiskLevel(String overallRiskLevel) {
            this.overallRiskLevel = overallRiskLevel;
            return this;
        }

        /**
         * 设置风险等级描述。
         *
         * @param riskLevelDescription 风险等级描述
         * @return Builder 实例
         */
        public Builder riskLevelDescription(String riskLevelDescription) {
            this.riskLevelDescription = riskLevelDescription;
            return this;
        }

        /**
         * 设置风险细分。
         *
         * @param riskBreakdown 风险细分
         * @return Builder 实例
         */
        public Builder riskBreakdown(RiskBreakdown riskBreakdown) {
            this.riskBreakdown = copyRiskBreakdown(riskBreakdown);
            return this;
        }

        /**
         * 设置风险指标列表。
         *
         * @param metrics 风险指标列表
         * @return Builder 实例
         */
        public Builder metrics(List<RiskMetric> metrics) {
            this.metrics = CollectionCopyUtils.copyList(metrics);
            return this;
        }

        /**
         * 设置风险警报列表。
         *
         * @param alerts 风险警报列表
         * @return Builder 实例
         */
        public Builder alerts(List<RiskAlert> alerts) {
            this.alerts = CollectionCopyUtils.copyList(alerts);
            return this;
        }

        /**
         * 设置风险管理建议列表。
         *
         * @param suggestions 风险管理建议列表
         * @return Builder 实例
         */
        public Builder suggestions(List<RiskManagementSuggestion> suggestions) {
            this.suggestions = CollectionCopyUtils.copyList(suggestions);
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
         * @return RiskAssessmentResponse 实例
         */
        public RiskAssessmentResponse build() {
            RiskAssessmentResponse response = new RiskAssessmentResponse();
            response.portfolioId = portfolioId;
            response.overallRiskScore = overallRiskScore;
            response.overallRiskLevel = overallRiskLevel;
            response.riskLevelDescription = riskLevelDescription;
            response.riskBreakdown = copyRiskBreakdown(riskBreakdown);
            response.metrics = CollectionCopyUtils.copyList(metrics);
            response.alerts = CollectionCopyUtils.copyList(alerts);
            response.suggestions = CollectionCopyUtils.copyList(suggestions);
            response.generatedAt = generatedAt;
            return response;
        }
    }

    /**
     * 复制风险细分对象。
     *
     * @param source 源对象
     * @return 副本
     */
    private static RiskBreakdown copyRiskBreakdown(RiskBreakdown source) {
        if (source == null) {
            return null;
        }
        return RiskBreakdown.builder()
                .marketRisk(source.getMarketRisk())
                .concentrationRisk(source.getConcentrationRisk())
                .volatilityRisk(source.getVolatilityRisk())
                .liquidityRisk(source.getLiquidityRisk())
                .currencyRisk(source.getCurrencyRisk())
                .build();
    }

    /**
     * 风险细分。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskBreakdown {

        /**
         * 市场风险。
         */
        private Integer marketRisk;

        /**
         * 集中度风险。
         */
        private Integer concentrationRisk;

        /**
         * 波动率风险。
         */
        private Integer volatilityRisk;

        /**
         * 流动性风险。
         */
        private Integer liquidityRisk;

        /**
         * 汇率风险。
         */
        private Integer currencyRisk;

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

            private Integer marketRisk;
            private Integer concentrationRisk;
            private Integer volatilityRisk;
            private Integer liquidityRisk;
            private Integer currencyRisk;

            /**
             * 设置市场风险。
             *
             * @param marketRisk 市场风险
             * @return Builder 实例
             */
            public Builder marketRisk(Integer marketRisk) {
                this.marketRisk = marketRisk;
                return this;
            }

            /**
             * 设置集中度风险。
             *
             * @param concentrationRisk 集中度风险
             * @return Builder 实例
             */
            public Builder concentrationRisk(Integer concentrationRisk) {
                this.concentrationRisk = concentrationRisk;
                return this;
            }

            /**
             * 设置波动率风险。
             *
             * @param volatilityRisk 波动率风险
             * @return Builder 实例
             */
            public Builder volatilityRisk(Integer volatilityRisk) {
                this.volatilityRisk = volatilityRisk;
                return this;
            }

            /**
             * 设置流动性风险。
             *
             * @param liquidityRisk 流动性风险
             * @return Builder 实例
             */
            public Builder liquidityRisk(Integer liquidityRisk) {
                this.liquidityRisk = liquidityRisk;
                return this;
            }

            /**
             * 设置汇率风险。
             *
             * @param currencyRisk 汇率风险
             * @return Builder 实例
             */
            public Builder currencyRisk(Integer currencyRisk) {
                this.currencyRisk = currencyRisk;
                return this;
            }

            /**
             * 构建风险细分对象。
             *
             * @return RiskBreakdown 实例
             */
            public RiskBreakdown build() {
                return new RiskBreakdown(
                        marketRisk,
                        concentrationRisk,
                        volatilityRisk,
                        liquidityRisk,
                        currencyRisk
                );
            }
        }
    }

    /**
     * 风险指标。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskMetric {

        /**
         * 指标名称。
         */
        private String name;

        /**
         * 指标值。
         */
        private String value;

        /**
         * 基准值。
         */
        private String benchmark;

        /**
         * 评估。
         */
        private String assessment;

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

            private String name;
            private String value;
            private String benchmark;
            private String assessment;

            /**
             * 设置指标名称。
             *
             * @param name 指标名称
             * @return Builder 实例
             */
            public Builder name(String name) {
                this.name = name;
                return this;
            }

            /**
             * 设置指标值。
             *
             * @param value 指标值
             * @return Builder 实例
             */
            public Builder value(String value) {
                this.value = value;
                return this;
            }

            /**
             * 设置基准值。
             *
             * @param benchmark 基准值
             * @return Builder 实例
             */
            public Builder benchmark(String benchmark) {
                this.benchmark = benchmark;
                return this;
            }

            /**
             * 设置评估。
             *
             * @param assessment 评估
             * @return Builder 实例
             */
            public Builder assessment(String assessment) {
                this.assessment = assessment;
                return this;
            }

            /**
             * 构建风险指标对象。
             *
             * @return RiskMetric 实例
             */
            public RiskMetric build() {
                return new RiskMetric(name, value, benchmark, assessment);
            }
        }
    }

    /**
     * 风险警报。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskAlert {

        /**
         * 警报类型。
         */
        private String type;

        /**
         * 严重级别。
         */
        private String severity;

        /**
         * 消息。
         */
        private String message;

        /**
         * 建议。
         */
        private String suggestion;

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
            private String severity;
            private String message;
            private String suggestion;

            /**
             * 设置警报类型。
             *
             * @param type 警报类型
             * @return Builder 实例
             */
            public Builder type(String type) {
                this.type = type;
                return this;
            }

            /**
             * 设置严重级别。
             *
             * @param severity 严重级别
             * @return Builder 实例
             */
            public Builder severity(String severity) {
                this.severity = severity;
                return this;
            }

            /**
             * 设置消息。
             *
             * @param message 消息
             * @return Builder 实例
             */
            public Builder message(String message) {
                this.message = message;
                return this;
            }

            /**
             * 设置建议。
             *
             * @param suggestion 建议
             * @return Builder 实例
             */
            public Builder suggestion(String suggestion) {
                this.suggestion = suggestion;
                return this;
            }

            /**
             * 构建风险警报对象。
             *
             * @return RiskAlert 实例
             */
            public RiskAlert build() {
                return new RiskAlert(type, severity, message, suggestion);
            }
        }
    }

    /**
     * 风险管理建议。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskManagementSuggestion {

        /**
         * 类别。
         */
        private String category;

        /**
         * 行动。
         */
        private String action;

        /**
         * 预期收益。
         */
        private String expectedBenefit;

        /**
         * 优先级。
         */
        private String priority;

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

            private String category;
            private String action;
            private String expectedBenefit;
            private String priority;

            /**
             * 设置类别。
             *
             * @param category 类别
             * @return Builder 实例
             */
            public Builder category(String category) {
                this.category = category;
                return this;
            }

            /**
             * 设置行动。
             *
             * @param action 行动
             * @return Builder 实例
             */
            public Builder action(String action) {
                this.action = action;
                return this;
            }

            /**
             * 设置预期收益。
             *
             * @param expectedBenefit 预期收益
             * @return Builder 实例
             */
            public Builder expectedBenefit(String expectedBenefit) {
                this.expectedBenefit = expectedBenefit;
                return this;
            }

            /**
             * 设置优先级。
             *
             * @param priority 优先级
             * @return Builder 实例
             */
            public Builder priority(String priority) {
                this.priority = priority;
                return this;
            }

            /**
             * 构建风险管理建议对象。
             *
             * @return RiskManagementSuggestion 实例
             */
            public RiskManagementSuggestion build() {
                return new RiskManagementSuggestion(
                        category,
                        action,
                        expectedBenefit,
                        priority
                );
            }
        }
    }
}
