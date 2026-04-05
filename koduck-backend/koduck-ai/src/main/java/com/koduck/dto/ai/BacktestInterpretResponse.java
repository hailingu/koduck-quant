package com.koduck.dto.ai;

import java.time.LocalDateTime;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 回测解读响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class BacktestInterpretResponse {

    /**
     * 回测结果ID。
     */
    private Long backtestResultId;

    /**
     * 策略名称。
     */
    private String strategyName;

    /**
     * 业绩解读。
     */
    private PerformanceInterpretation performance;

    /**
     * 风险解读。
     */
    private RiskInterpretation risk;

    /**
     * 交易行为分析。
     */
    private TradingBehaviorAnalysis tradingBehavior;

    /**
     * 改进建议列表。
     */
    private List<ImprovementSuggestion> improvements;

    /**
     * 总体评估。
     */
    private String overallAssessment;

    /**
     * 推荐建议。
     */
    private String recommendation;

    /**
     * 生成时间。
     */
    private LocalDateTime generatedAt;

    /**
     * 获取改进建议列表的副本。
     *
     * @return 改进建议列表副本
     */
    public List<ImprovementSuggestion> getImprovements() {
        return CollectionCopyUtils.copyList(improvements);
    }

    /**
     * 设置改进建议列表。
     *
     * @param improvements 改进建议列表
     */
    public void setImprovements(List<ImprovementSuggestion> improvements) {
        this.improvements = CollectionCopyUtils.copyList(improvements);
    }

    /**
     * 获取业绩解读的副本。
     *
     * @return 业绩解读副本
     */
    public PerformanceInterpretation getPerformance() {
        return copyPerformance(performance);
    }

    /**
     * 设置业绩解读。
     *
     * @param performance 业绩解读
     */
    public void setPerformance(PerformanceInterpretation performance) {
        this.performance = copyPerformance(performance);
    }

    /**
     * 获取风险解读的副本。
     *
     * @return 风险解读副本
     */
    public RiskInterpretation getRisk() {
        return copyRisk(risk);
    }

    /**
     * 设置风险解读。
     *
     * @param risk 风险解读
     */
    public void setRisk(RiskInterpretation risk) {
        this.risk = copyRisk(risk);
    }

    /**
     * 获取交易行为分析的副本。
     *
     * @return 交易行为分析副本
     */
    public TradingBehaviorAnalysis getTradingBehavior() {
        return copyTradingBehavior(tradingBehavior);
    }

    /**
     * 设置交易行为分析。
     *
     * @param tradingBehavior 交易行为分析
     */
    public void setTradingBehavior(TradingBehaviorAnalysis tradingBehavior) {
        this.tradingBehavior = copyTradingBehavior(tradingBehavior);
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

        /** 回测结果ID。 */
        private Long backtestResultId;
        /** 策略名称。 */
        private String strategyName;
        /** 业绩解读。 */
        private PerformanceInterpretation performance;
        /** 风险解读。 */
        private RiskInterpretation risk;
        /** 交易行为分析。 */
        private TradingBehaviorAnalysis tradingBehavior;
        /** 改进建议列表。 */
        private List<ImprovementSuggestion> improvements;
        /** 总体评估。 */
        private String overallAssessment;
        /** 推荐建议。 */
        private String recommendation;
        /** 生成时间。 */
        private LocalDateTime generatedAt;

        /**
         * 设置回测结果ID。
         *
         * @param backtestResultId 回测结果ID
         * @return Builder 实例
         */
        public Builder backtestResultId(Long backtestResultId) {
            this.backtestResultId = backtestResultId;
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
         * 设置业绩解读。
         *
         * @param performance 业绩解读
         * @return Builder 实例
         */
        public Builder performance(PerformanceInterpretation performance) {
            this.performance = copyPerformance(performance);
            return this;
        }

        /**
         * 设置风险解读。
         *
         * @param risk 风险解读
         * @return Builder 实例
         */
        public Builder risk(RiskInterpretation risk) {
            this.risk = copyRisk(risk);
            return this;
        }

        /**
         * 设置交易行为分析。
         *
         * @param tradingBehavior 交易行为分析
         * @return Builder 实例
         */
        public Builder tradingBehavior(TradingBehaviorAnalysis tradingBehavior) {
            this.tradingBehavior = copyTradingBehavior(tradingBehavior);
            return this;
        }

        /**
         * 设置改进建议列表。
         *
         * @param improvements 改进建议列表
         * @return Builder 实例
         */
        public Builder improvements(List<ImprovementSuggestion> improvements) {
            this.improvements = CollectionCopyUtils.copyList(improvements);
            return this;
        }

        /**
         * 设置总体评估。
         *
         * @param overallAssessment 总体评估
         * @return Builder 实例
         */
        public Builder overallAssessment(String overallAssessment) {
            this.overallAssessment = overallAssessment;
            return this;
        }

        /**
         * 设置推荐建议。
         *
         * @param recommendation 推荐建议
         * @return Builder 实例
         */
        public Builder recommendation(String recommendation) {
            this.recommendation = recommendation;
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
         * @return BacktestInterpretResponse 实例
         */
        public BacktestInterpretResponse build() {
            BacktestInterpretResponse response = new BacktestInterpretResponse();
            response.backtestResultId = backtestResultId;
            response.strategyName = strategyName;
            response.performance = copyPerformance(performance);
            response.risk = copyRisk(risk);
            response.tradingBehavior = copyTradingBehavior(tradingBehavior);
            response.improvements = CollectionCopyUtils.copyList(improvements);
            response.overallAssessment = overallAssessment;
            response.recommendation = recommendation;
            response.generatedAt = generatedAt;
            return response;
        }
    }

    /**
     * 复制业绩解读对象。
     *
     * @param source 源对象
     * @return 副本
     */
    private static PerformanceInterpretation copyPerformance(
            PerformanceInterpretation source
    ) {
        if (source == null) {
            return null;
        }
        return PerformanceInterpretation.builder()
                .totalReturnAssessment(source.getTotalReturnAssessment())
                .annualizedReturnAssessment(source.getAnnualizedReturnAssessment())
                .benchmarkComparison(source.getBenchmarkComparison())
                .consistencyEvaluation(source.getConsistencyEvaluation())
                .build();
    }

    /**
     * 复制风险解读对象。
     *
     * @param source 源对象
     * @return 副本
     */
    private static RiskInterpretation copyRisk(RiskInterpretation source) {
        if (source == null) {
            return null;
        }
        return RiskInterpretation.builder()
                .maxDrawdownAssessment(source.getMaxDrawdownAssessment())
                .volatilityAssessment(source.getVolatilityAssessment())
                .sharpeRatioAssessment(source.getSharpeRatioAssessment())
                .riskAdjustedReturn(source.getRiskAdjustedReturn())
                .build();
    }

    /**
     * 复制交易行为分析对象。
     *
     * @param source 源对象
     * @return 副本
     */
    private static TradingBehaviorAnalysis copyTradingBehavior(
            TradingBehaviorAnalysis source
    ) {
        if (source == null) {
            return null;
        }
        return TradingBehaviorAnalysis.builder()
                .winRateAnalysis(source.getWinRateAnalysis())
                .profitFactorAnalysis(source.getProfitFactorAnalysis())
                .tradeFrequencyAssessment(source.getTradeFrequencyAssessment())
                .timingEvaluation(source.getTimingEvaluation())
                .build();
    }

    /**
     * 业绩解读。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PerformanceInterpretation {

        /**
         * 总收益评估。
         */
        private String totalReturnAssessment;

        /**
         * 年化收益评估。
         */
        private String annualizedReturnAssessment;

        /**
         * 基准对比。
         */
        private String benchmarkComparison;

        /**
         * 一致性评估。
         */
        private String consistencyEvaluation;

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

            /** 总收益评估。 */
            private String totalReturnAssessment;
            /** 年化收益评估。 */
            private String annualizedReturnAssessment;
            /** 基准对比。 */
            private String benchmarkComparison;
            /** 一致性评估。 */
            private String consistencyEvaluation;

            /**
             * 设置总收益评估。
             *
             * @param totalReturnAssessment 总收益评估
             * @return Builder 实例
             */
            public Builder totalReturnAssessment(String totalReturnAssessment) {
                this.totalReturnAssessment = totalReturnAssessment;
                return this;
            }

            /**
             * 设置年化收益评估。
             *
             * @param annualizedReturnAssessment 年化收益评估
             * @return Builder 实例
             */
            public Builder annualizedReturnAssessment(
                    String annualizedReturnAssessment
            ) {
                this.annualizedReturnAssessment = annualizedReturnAssessment;
                return this;
            }

            /**
             * 设置基准对比。
             *
             * @param benchmarkComparison 基准对比
             * @return Builder 实例
             */
            public Builder benchmarkComparison(String benchmarkComparison) {
                this.benchmarkComparison = benchmarkComparison;
                return this;
            }

            /**
             * 设置一致性评估。
             *
             * @param consistencyEvaluation 一致性评估
             * @return Builder 实例
             */
            public Builder consistencyEvaluation(String consistencyEvaluation) {
                this.consistencyEvaluation = consistencyEvaluation;
                return this;
            }

            /**
             * 构建业绩解读对象。
             *
             * @return PerformanceInterpretation 实例
             */
            public PerformanceInterpretation build() {
                return new PerformanceInterpretation(
                        totalReturnAssessment,
                        annualizedReturnAssessment,
                        benchmarkComparison,
                        consistencyEvaluation
                );
            }
        }
    }

    /**
     * 风险解读。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskInterpretation {

        /**
         * 最大回撤评估。
         */
        private String maxDrawdownAssessment;

        /**
         * 波动率评估。
         */
        private String volatilityAssessment;

        /**
         * 夏普比率评估。
         */
        private String sharpeRatioAssessment;

        /**
         * 风险调整后收益。
         */
        private String riskAdjustedReturn;

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

            /** 最大回撤评估。 */
            private String maxDrawdownAssessment;
            /** 波动率评估。 */
            private String volatilityAssessment;
            /** 夏普比率评估。 */
            private String sharpeRatioAssessment;
            /** 风险调整后收益。 */
            private String riskAdjustedReturn;

            /**
             * 设置最大回撤评估。
             *
             * @param maxDrawdownAssessment 最大回撤评估
             * @return Builder 实例
             */
            public Builder maxDrawdownAssessment(String maxDrawdownAssessment) {
                this.maxDrawdownAssessment = maxDrawdownAssessment;
                return this;
            }

            /**
             * 设置波动率评估。
             *
             * @param volatilityAssessment 波动率评估
             * @return Builder 实例
             */
            public Builder volatilityAssessment(String volatilityAssessment) {
                this.volatilityAssessment = volatilityAssessment;
                return this;
            }

            /**
             * 设置夏普比率评估。
             *
             * @param sharpeRatioAssessment 夏普比率评估
             * @return Builder 实例
             */
            public Builder sharpeRatioAssessment(String sharpeRatioAssessment) {
                this.sharpeRatioAssessment = sharpeRatioAssessment;
                return this;
            }

            /**
             * 设置风险调整后收益。
             *
             * @param riskAdjustedReturn 风险调整后收益
             * @return Builder 实例
             */
            public Builder riskAdjustedReturn(String riskAdjustedReturn) {
                this.riskAdjustedReturn = riskAdjustedReturn;
                return this;
            }

            /**
             * 构建风险解读对象。
             *
             * @return RiskInterpretation 实例
             */
            public RiskInterpretation build() {
                return new RiskInterpretation(
                        maxDrawdownAssessment,
                        volatilityAssessment,
                        sharpeRatioAssessment,
                        riskAdjustedReturn
                );
            }
        }
    }

    /**
     * 交易行为分析。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradingBehaviorAnalysis {

        /**
         * 胜率分析。
         */
        private String winRateAnalysis;

        /**
         * 盈亏比分析。
         */
        private String profitFactorAnalysis;

        /**
         * 交易频率评估。
         */
        private String tradeFrequencyAssessment;

        /**
         * 时机评估。
         */
        private String timingEvaluation;

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

            /** 胜率分析。 */
            private String winRateAnalysis;
            /** 盈亏比分析。 */
            private String profitFactorAnalysis;
            /** 交易频率评估。 */
            private String tradeFrequencyAssessment;
            /** 时机评估。 */
            private String timingEvaluation;

            /**
             * 设置胜率分析。
             *
             * @param winRateAnalysis 胜率分析
             * @return Builder 实例
             */
            public Builder winRateAnalysis(String winRateAnalysis) {
                this.winRateAnalysis = winRateAnalysis;
                return this;
            }

            /**
             * 设置盈亏比分析。
             *
             * @param profitFactorAnalysis 盈亏比分析
             * @return Builder 实例
             */
            public Builder profitFactorAnalysis(String profitFactorAnalysis) {
                this.profitFactorAnalysis = profitFactorAnalysis;
                return this;
            }

            /**
             * 设置交易频率评估。
             *
             * @param tradeFrequencyAssessment 交易频率评估
             * @return Builder 实例
             */
            public Builder tradeFrequencyAssessment(
                    String tradeFrequencyAssessment
            ) {
                this.tradeFrequencyAssessment = tradeFrequencyAssessment;
                return this;
            }

            /**
             * 设置时机评估。
             *
             * @param timingEvaluation 时机评估
             * @return Builder 实例
             */
            public Builder timingEvaluation(String timingEvaluation) {
                this.timingEvaluation = timingEvaluation;
                return this;
            }

            /**
             * 构建交易行为分析对象。
             *
             * @return TradingBehaviorAnalysis 实例
             */
            public TradingBehaviorAnalysis build() {
                return new TradingBehaviorAnalysis(
                        winRateAnalysis,
                        profitFactorAnalysis,
                        tradeFrequencyAssessment,
                        timingEvaluation
                );
            }
        }
    }

    /**
     * 改进建议。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImprovementSuggestion {

        /**
         * 类别。
         */
        private String category;

        /**
         * 建议内容。
         */
        private String suggestion;

        /**
         * 预期影响。
         */
        private String expectedImpact;

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

            /** 类别。 */
            private String category;
            /** 建议内容。 */
            private String suggestion;
            /** 预期影响。 */
            private String expectedImpact;
            /** 优先级。 */
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
             * 设置建议内容。
             *
             * @param suggestion 建议内容
             * @return Builder 实例
             */
            public Builder suggestion(String suggestion) {
                this.suggestion = suggestion;
                return this;
            }

            /**
             * 设置预期影响。
             *
             * @param expectedImpact 预期影响
             * @return Builder 实例
             */
            public Builder expectedImpact(String expectedImpact) {
                this.expectedImpact = expectedImpact;
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
             * 构建改进建议对象。
             *
             * @return ImprovementSuggestion 实例
             */
            public ImprovementSuggestion build() {
                return new ImprovementSuggestion(
                        category,
                        suggestion,
                        expectedImpact,
                        priority
                );
            }
        }
    }
}
