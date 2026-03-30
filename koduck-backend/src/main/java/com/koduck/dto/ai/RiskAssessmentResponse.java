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

    public RiskBreakdown getRiskBreakdown() {
        return copyRiskBreakdown(riskBreakdown);
    }

    public void setRiskBreakdown(RiskBreakdown riskBreakdown) {
        this.riskBreakdown = copyRiskBreakdown(riskBreakdown);
    }

    public List<RiskMetric> getMetrics() {
        return CollectionCopyUtils.copyList(metrics);
    }

    public void setMetrics(List<RiskMetric> metrics) {
        this.metrics = CollectionCopyUtils.copyList(metrics);
    }

    public List<RiskAlert> getAlerts() {
        return CollectionCopyUtils.copyList(alerts);
    }

    public void setAlerts(List<RiskAlert> alerts) {
        this.alerts = CollectionCopyUtils.copyList(alerts);
    }

    public List<RiskManagementSuggestion> getSuggestions() {
        return CollectionCopyUtils.copyList(suggestions);
    }

    public void setSuggestions(List<RiskManagementSuggestion> suggestions) {
        this.suggestions = CollectionCopyUtils.copyList(suggestions);
    }

    public static Builder builder() {
        return new Builder();
    }

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

        public Builder portfolioId(Long portfolioId) {
            this.portfolioId = portfolioId;
            return this;
        }

        public Builder overallRiskScore(Integer overallRiskScore) {
            this.overallRiskScore = overallRiskScore;
            return this;
        }

        public Builder overallRiskLevel(String overallRiskLevel) {
            this.overallRiskLevel = overallRiskLevel;
            return this;
        }

        public Builder riskLevelDescription(String riskLevelDescription) {
            this.riskLevelDescription = riskLevelDescription;
            return this;
        }

        public Builder riskBreakdown(RiskBreakdown riskBreakdown) {
            this.riskBreakdown = copyRiskBreakdown(riskBreakdown);
            return this;
        }

        public Builder metrics(List<RiskMetric> metrics) {
            this.metrics = CollectionCopyUtils.copyList(metrics);
            return this;
        }

        public Builder alerts(List<RiskAlert> alerts) {
            this.alerts = CollectionCopyUtils.copyList(alerts);
            return this;
        }

        public Builder suggestions(List<RiskManagementSuggestion> suggestions) {
            this.suggestions = CollectionCopyUtils.copyList(suggestions);
            return this;
        }

        public Builder generatedAt(LocalDateTime generatedAt) {
            this.generatedAt = generatedAt;
            return this;
        }

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
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskBreakdown {
        private Integer marketRisk;
        private Integer concentrationRisk;
        private Integer volatilityRisk;
        private Integer liquidityRisk;
        private Integer currencyRisk;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private Integer marketRisk;
            private Integer concentrationRisk;
            private Integer volatilityRisk;
            private Integer liquidityRisk;
            private Integer currencyRisk;

            public Builder marketRisk(Integer marketRisk) {
                this.marketRisk = marketRisk;
                return this;
            }

            public Builder concentrationRisk(Integer concentrationRisk) {
                this.concentrationRisk = concentrationRisk;
                return this;
            }

            public Builder volatilityRisk(Integer volatilityRisk) {
                this.volatilityRisk = volatilityRisk;
                return this;
            }

            public Builder liquidityRisk(Integer liquidityRisk) {
                this.liquidityRisk = liquidityRisk;
                return this;
            }

            public Builder currencyRisk(Integer currencyRisk) {
                this.currencyRisk = currencyRisk;
                return this;
            }

            public RiskBreakdown build() {
                return new RiskBreakdown(marketRisk, concentrationRisk, volatilityRisk, liquidityRisk, currencyRisk);
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskMetric {
        private String name;
        private String value;
        private String benchmark;
        private String assessment;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String name;
            private String value;
            private String benchmark;
            private String assessment;

            public Builder name(String name) {
                this.name = name;
                return this;
            }

            public Builder value(String value) {
                this.value = value;
                return this;
            }

            public Builder benchmark(String benchmark) {
                this.benchmark = benchmark;
                return this;
            }

            public Builder assessment(String assessment) {
                this.assessment = assessment;
                return this;
            }

            public RiskMetric build() {
                return new RiskMetric(name, value, benchmark, assessment);
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskAlert {
        private String type;
        private String severity;
        private String message;
        private String suggestion;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String type;
            private String severity;
            private String message;
            private String suggestion;

            public Builder type(String type) {
                this.type = type;
                return this;
            }

            public Builder severity(String severity) {
                this.severity = severity;
                return this;
            }

            public Builder message(String message) {
                this.message = message;
                return this;
            }

            public Builder suggestion(String suggestion) {
                this.suggestion = suggestion;
                return this;
            }

            public RiskAlert build() {
                return new RiskAlert(type, severity, message, suggestion);
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskManagementSuggestion {
        private String category;
        private String action;
        private String expectedBenefit;
        private String priority;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String category;
            private String action;
            private String expectedBenefit;
            private String priority;

            public Builder category(String category) {
                this.category = category;
                return this;
            }

            public Builder action(String action) {
                this.action = action;
                return this;
            }

            public Builder expectedBenefit(String expectedBenefit) {
                this.expectedBenefit = expectedBenefit;
                return this;
            }

            public Builder priority(String priority) {
                this.priority = priority;
                return this;
            }

            public RiskManagementSuggestion build() {
                return new RiskManagementSuggestion(category, action, expectedBenefit, priority);
            }
        }
    }
}
