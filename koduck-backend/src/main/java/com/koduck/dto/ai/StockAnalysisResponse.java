package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAnalysisResponse {

    // analysis
    private String analysis;
    private String provider;
    private String model;
    
    private String symbol;
    private String market;
    private String analysisType;

    // 
    private Integer overallScore;
    private String overallRating;

    // 
    private TechnicalAnalysis technical;

    // 
    private FundamentalAnalysis fundamental;

    // 
    private SentimentAnalysis sentiment;

    // AI 
    private String recommendation;
    private String reasoning;

    // 
    private List<KeyMetric> keyMetrics;

    // 
    private List<RiskFactor> riskFactors;

    private LocalDateTime generatedAt;

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechnicalAnalysis {
        private Integer score;
        private String trend;
        private String maSignal;
        private String macdSignal;
        private String rsiSignal;
        private String supportLevel;
        private String resistanceLevel;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FundamentalAnalysis {
        private Integer score;
        private String peEvaluation;
        private String pbEvaluation;
        private String profitability;
        private String growthPotential;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentAnalysis {
        private Integer score;
        private String marketSentiment;
        private String newsSentiment;
        private String socialSentiment;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyMetric {
        private String name;
        private String value;
        private String interpretation;
    }

    /**
     * 
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskFactor {
        private String type;
        private String description;
        private String severity;
    }
}
