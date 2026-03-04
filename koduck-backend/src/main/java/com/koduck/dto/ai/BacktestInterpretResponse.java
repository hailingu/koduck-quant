package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 回测结果解读响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestInterpretResponse {

    private Long backtestResultId;
    private String strategyName;

    // 绩效解读
    private PerformanceInterpretation performance;

    // 风险解读
    private RiskInterpretation risk;

    // 交易行为分析
    private TradingBehaviorAnalysis tradingBehavior;

    // 改进建议
    private List<ImprovementSuggestion> improvements;

    // 总体评价
    private String overallAssessment;
    private String recommendation;

    private LocalDateTime generatedAt;

    /**
     * 绩效解读
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
     * 风险解读
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
     * 交易行为分析
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
     * 改进建议
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
