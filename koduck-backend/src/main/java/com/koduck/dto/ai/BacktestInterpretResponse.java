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
@AllArgsConstructor
public class BacktestInterpretResponse {

    private Long backtestResultId;
    private String strategyName;

    // 
    private PerformanceInterpretation performance;

    // 
    private RiskInterpretation risk;

    // 
    private TradingBehaviorAnalysis tradingBehavior;

    // 
    private List<ImprovementSuggestion> improvements;

    // 
    private String overallAssessment;
    private String recommendation;

    private LocalDateTime generatedAt;

    public List<ImprovementSuggestion> getImprovements() {
        return CollectionCopyUtils.copyList(improvements);
    }

    public void setImprovements(List<ImprovementSuggestion> improvements) {
        this.improvements = CollectionCopyUtils.copyList(improvements);
    }

    public PerformanceInterpretation getPerformance() {
        return copyPerformance(performance);
    }

    public void setPerformance(PerformanceInterpretation performance) {
        this.performance = copyPerformance(performance);
    }

    public RiskInterpretation getRisk() {
        return copyRisk(risk);
    }

    public void setRisk(RiskInterpretation risk) {
        this.risk = copyRisk(risk);
    }

    public TradingBehaviorAnalysis getTradingBehavior() {
        return copyTradingBehavior(tradingBehavior);
    }

    public void setTradingBehavior(TradingBehaviorAnalysis tradingBehavior) {
        this.tradingBehavior = copyTradingBehavior(tradingBehavior);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long backtestResultId;
        private String strategyName;
        private PerformanceInterpretation performance;
        private RiskInterpretation risk;
        private TradingBehaviorAnalysis tradingBehavior;
        private List<ImprovementSuggestion> improvements;
        private String overallAssessment;
        private String recommendation;
        private LocalDateTime generatedAt;

        public Builder backtestResultId(Long backtestResultId) {
            this.backtestResultId = backtestResultId;
            return this;
        }

        public Builder strategyName(String strategyName) {
            this.strategyName = strategyName;
            return this;
        }

        public Builder performance(PerformanceInterpretation performance) {
            this.performance = copyPerformance(performance);
            return this;
        }

        public Builder risk(RiskInterpretation risk) {
            this.risk = copyRisk(risk);
            return this;
        }

        public Builder tradingBehavior(TradingBehaviorAnalysis tradingBehavior) {
            this.tradingBehavior = copyTradingBehavior(tradingBehavior);
            return this;
        }

        public Builder improvements(List<ImprovementSuggestion> improvements) {
            this.improvements = CollectionCopyUtils.copyList(improvements);
            return this;
        }

        public Builder overallAssessment(String overallAssessment) {
            this.overallAssessment = overallAssessment;
            return this;
        }

        public Builder recommendation(String recommendation) {
            this.recommendation = recommendation;
            return this;
        }

        public Builder generatedAt(LocalDateTime generatedAt) {
            this.generatedAt = generatedAt;
            return this;
        }

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

    private static PerformanceInterpretation copyPerformance(PerformanceInterpretation source) {
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

    private static TradingBehaviorAnalysis copyTradingBehavior(TradingBehaviorAnalysis source) {
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
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PerformanceInterpretation {
        private String totalReturnAssessment;
        private String annualizedReturnAssessment;
        private String benchmarkComparison;
        private String consistencyEvaluation;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String totalReturnAssessment;
            private String annualizedReturnAssessment;
            private String benchmarkComparison;
            private String consistencyEvaluation;

            public Builder totalReturnAssessment(String totalReturnAssessment) {
                this.totalReturnAssessment = totalReturnAssessment;
                return this;
            }

            public Builder annualizedReturnAssessment(String annualizedReturnAssessment) {
                this.annualizedReturnAssessment = annualizedReturnAssessment;
                return this;
            }

            public Builder benchmarkComparison(String benchmarkComparison) {
                this.benchmarkComparison = benchmarkComparison;
                return this;
            }

            public Builder consistencyEvaluation(String consistencyEvaluation) {
                this.consistencyEvaluation = consistencyEvaluation;
                return this;
            }

            public PerformanceInterpretation build() {
                return new PerformanceInterpretation(totalReturnAssessment, annualizedReturnAssessment, benchmarkComparison, consistencyEvaluation);
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskInterpretation {
        private String maxDrawdownAssessment;
        private String volatilityAssessment;
        private String sharpeRatioAssessment;
        private String riskAdjustedReturn;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String maxDrawdownAssessment;
            private String volatilityAssessment;
            private String sharpeRatioAssessment;
            private String riskAdjustedReturn;

            public Builder maxDrawdownAssessment(String maxDrawdownAssessment) {
                this.maxDrawdownAssessment = maxDrawdownAssessment;
                return this;
            }

            public Builder volatilityAssessment(String volatilityAssessment) {
                this.volatilityAssessment = volatilityAssessment;
                return this;
            }

            public Builder sharpeRatioAssessment(String sharpeRatioAssessment) {
                this.sharpeRatioAssessment = sharpeRatioAssessment;
                return this;
            }

            public Builder riskAdjustedReturn(String riskAdjustedReturn) {
                this.riskAdjustedReturn = riskAdjustedReturn;
                return this;
            }

            public RiskInterpretation build() {
                return new RiskInterpretation(maxDrawdownAssessment, volatilityAssessment, sharpeRatioAssessment, riskAdjustedReturn);
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradingBehaviorAnalysis {
        private String winRateAnalysis;
        private String profitFactorAnalysis;
        private String tradeFrequencyAssessment;
        private String timingEvaluation;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String winRateAnalysis;
            private String profitFactorAnalysis;
            private String tradeFrequencyAssessment;
            private String timingEvaluation;

            public Builder winRateAnalysis(String winRateAnalysis) {
                this.winRateAnalysis = winRateAnalysis;
                return this;
            }

            public Builder profitFactorAnalysis(String profitFactorAnalysis) {
                this.profitFactorAnalysis = profitFactorAnalysis;
                return this;
            }

            public Builder tradeFrequencyAssessment(String tradeFrequencyAssessment) {
                this.tradeFrequencyAssessment = tradeFrequencyAssessment;
                return this;
            }

            public Builder timingEvaluation(String timingEvaluation) {
                this.timingEvaluation = timingEvaluation;
                return this;
            }

            public TradingBehaviorAnalysis build() {
                return new TradingBehaviorAnalysis(winRateAnalysis, profitFactorAnalysis, tradeFrequencyAssessment, timingEvaluation);
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImprovementSuggestion {
        private String category;
        private String suggestion;
        private String expectedImpact;
        private String priority;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String category;
            private String suggestion;
            private String expectedImpact;
            private String priority;

            public Builder category(String category) {
                this.category = category;
                return this;
            }

            public Builder suggestion(String suggestion) {
                this.suggestion = suggestion;
                return this;
            }

            public Builder expectedImpact(String expectedImpact) {
                this.expectedImpact = expectedImpact;
                return this;
            }

            public Builder priority(String priority) {
                this.priority = priority;
                return this;
            }

            public ImprovementSuggestion build() {
                return new ImprovementSuggestion(category, suggestion, expectedImpact, priority);
            }
        }
    }
}
