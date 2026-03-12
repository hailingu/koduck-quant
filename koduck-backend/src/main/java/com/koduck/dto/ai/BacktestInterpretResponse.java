package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
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

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PerformanceInterpretation {
        private String totalReturnAssessment;
        private String annualizedReturnAssessment;
        private String benchmarkComparison;
        private String consistencyEvaluation;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskInterpretation {
        private String maxDrawdownAssessment;
        private String volatilityAssessment;
        private String sharpeRatioAssessment;
        private String riskAdjustedReturn;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradingBehaviorAnalysis {
        private String winRateAnalysis;
        private String profitFactorAnalysis;
        private String tradeFrequencyAssessment;
        private String timingEvaluation;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImprovementSuggestion {
        private String category;
        private String suggestion;
        private String expectedImpact;
        private String priority;
    }
}
