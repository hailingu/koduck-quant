package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 风险评估响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAssessmentResponse {

    private Long portfolioId;

    // 综合风险评分
    private Integer overallRiskScore;
    private String overallRiskLevel;
    private String riskLevelDescription;

    // 各类风险评分
    private RiskBreakdown riskBreakdown;

    // 风险指标
    private List<RiskMetric> metrics;

    // 风险提示
    private List<RiskAlert> alerts;

    // 风险管理建议
    private List<RiskManagementSuggestion> suggestions;

    private LocalDateTime generatedAt;

    /**
     * 风险细分
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskBreakdown {
        private Integer marketRisk;
        private Integer concentrationRisk;
        private Integer volatilityRisk;
        private Integer liquidityRisk;
        private Integer currencyRisk;
    }

    /**
     * 风险指标
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskMetric {
        private String name;
        private String value;
        private String benchmark;
        private String assessment;
    }

    /**
     * 风险预警
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskAlert {
        private String type;
        private String severity;
        private String message;
        private String suggestion;
    }

    /**
     * 风险管理建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskManagementSuggestion {
        private String category;
        private String action;
        private String expectedBenefit;
        private String priority;
    }
}
