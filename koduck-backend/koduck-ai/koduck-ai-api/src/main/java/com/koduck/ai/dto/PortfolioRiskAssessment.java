package com.koduck.ai.dto;

import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * 投资组合风险评估结果。
 */
@EqualsAndHashCode
@ToString
public class PortfolioRiskAssessment {
    private final Long portfolioId;
    private final String portfolioName;
    private final BigDecimal overallRiskScore;
    private final RiskLevel riskLevel;
    private final BigDecimal concentrationRisk;
    private final BigDecimal volatilityRisk;
    private final List<SectorRisk> sectorRisks;
    private final List<String> suggestions;

    private PortfolioRiskAssessment(Long portfolioId, String portfolioName,
                                    BigDecimal overallRiskScore, RiskLevel riskLevel,
                                    BigDecimal concentrationRisk, BigDecimal volatilityRisk,
                                    List<SectorRisk> sectorRisks, List<String> suggestions) {
        this.portfolioId = portfolioId;
        this.portfolioName = portfolioName;
        this.overallRiskScore = overallRiskScore;
        this.riskLevel = riskLevel;
        this.concentrationRisk = concentrationRisk;
        this.volatilityRisk = volatilityRisk;
        this.sectorRisks = sectorRisks;
        this.suggestions = suggestions;
    }

    /**
     * 创建构建器。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    public Long getPortfolioId() {
        return portfolioId;
    }

    public String getPortfolioName() {
        return portfolioName;
    }

    public BigDecimal getOverallRiskScore() {
        return overallRiskScore;
    }

    public RiskLevel getRiskLevel() {
        return riskLevel;
    }

    public BigDecimal getConcentrationRisk() {
        return concentrationRisk;
    }

    public BigDecimal getVolatilityRisk() {
        return volatilityRisk;
    }

    /**
     * 获取行业风险列表的防御性副本。
     *
     * @return 行业风险列表
     */
    public List<SectorRisk> getSectorRisks() {
        return sectorRisks == null ? Collections.emptyList() : new ArrayList<>(sectorRisks);
    }

    /**
     * 获取建议列表的防御性副本。
     *
     * @return 建议列表
     */
    public List<String> getSuggestions() {
        return suggestions == null ? Collections.emptyList() : new ArrayList<>(suggestions);
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH, EXTREME
    }

    /**
     * 构建器类。
     */
    public static class Builder {
        private Long portfolioId;
        private String portfolioName;
        private BigDecimal overallRiskScore;
        private RiskLevel riskLevel;
        private BigDecimal concentrationRisk;
        private BigDecimal volatilityRisk;
        private List<SectorRisk> sectorRisks;
        private List<String> suggestions;

        public Builder portfolioId(Long portfolioId) {
            this.portfolioId = portfolioId;
            return this;
        }

        public Builder portfolioName(String portfolioName) {
            this.portfolioName = portfolioName;
            return this;
        }

        public Builder overallRiskScore(BigDecimal overallRiskScore) {
            this.overallRiskScore = overallRiskScore;
            return this;
        }

        public Builder riskLevel(RiskLevel riskLevel) {
            this.riskLevel = riskLevel;
            return this;
        }

        public Builder concentrationRisk(BigDecimal concentrationRisk) {
            this.concentrationRisk = concentrationRisk;
            return this;
        }

        public Builder volatilityRisk(BigDecimal volatilityRisk) {
            this.volatilityRisk = volatilityRisk;
            return this;
        }

        public Builder sectorRisks(List<SectorRisk> sectorRisks) {
            this.sectorRisks = sectorRisks == null ? null : new ArrayList<>(sectorRisks);
            return this;
        }

        public Builder suggestions(List<String> suggestions) {
            this.suggestions = suggestions == null ? null : new ArrayList<>(suggestions);
            return this;
        }

        public PortfolioRiskAssessment build() {
            return new PortfolioRiskAssessment(
                    portfolioId, portfolioName, overallRiskScore, riskLevel,
                    concentrationRisk, volatilityRisk, sectorRisks, suggestions);
        }
    }

    /**
     * 行业风险信息。
     */
    @EqualsAndHashCode
    @ToString
    public static class SectorRisk {
        private final String sector;
        private final BigDecimal exposurePercent;
        private final RiskLevel level;
        private final String comment;

        private SectorRisk(String sector, BigDecimal exposurePercent,
                           RiskLevel level, String comment) {
            this.sector = sector;
            this.exposurePercent = exposurePercent;
            this.level = level;
            this.comment = comment;
        }

        public static Builder builder() {
            return new Builder();
        }

        public String getSector() {
            return sector;
        }

        public BigDecimal getExposurePercent() {
            return exposurePercent;
        }

        public RiskLevel getLevel() {
            return level;
        }

        public String getComment() {
            return comment;
        }

        public static class Builder {
            private String sector;
            private BigDecimal exposurePercent;
            private RiskLevel level;
            private String comment;

            public Builder sector(String sector) {
                this.sector = sector;
                return this;
            }

            public Builder exposurePercent(BigDecimal exposurePercent) {
                this.exposurePercent = exposurePercent;
                return this;
            }

            public Builder level(RiskLevel level) {
                this.level = level;
                return this;
            }

            public Builder comment(String comment) {
                this.comment = comment;
                return this;
            }

            public SectorRisk build() {
                return new SectorRisk(sector, exposurePercent, level, comment);
            }
        }
    }
}
