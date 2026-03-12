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
public class RiskAssessmentResponse {

    private Long portfolioId;

    // 
    private Integer overallRiskScore;
    private String overallRiskLevel;
    private String riskLevelDescription;

    // 
    private RiskBreakdown riskBreakdown;

    // 
    private List<RiskMetric> metrics;

    // 
    private List<RiskAlert> alerts;

    // 
    private List<RiskManagementSuggestion> suggestions;

    private LocalDateTime generatedAt;

    /**
     * 
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
     * 
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
     * 
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
     * 
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
