package com.koduck.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 股票分析响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAnalysisResponse {

    private String symbol;
    private String market;
    private String analysisType;

    // 综合评分
    private Integer overallScore;
    private String overallRating;

    // 技术分析结果
    private TechnicalAnalysis technical;

    // 基本面分析结果
    private FundamentalAnalysis fundamental;

    // 情绪分析结果
    private SentimentAnalysis sentiment;

    // AI 建议
    private String recommendation;
    private String reasoning;

    // 关键指标
    private List<KeyMetric> keyMetrics;

    // 风险提示
    private List<RiskFactor> riskFactors;

    private LocalDateTime generatedAt;

    /**
     * 技术分析
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
     * 基本面分析
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
     * 情绪分析
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
     * 关键指标
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
     * 风险因素
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
