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

    public TechnicalAnalysis getTechnical() {
        return copyTechnical(technical);
    }

    public void setTechnical(TechnicalAnalysis technical) {
        this.technical = copyTechnical(technical);
    }

    public FundamentalAnalysis getFundamental() {
        return copyFundamental(fundamental);
    }

    public void setFundamental(FundamentalAnalysis fundamental) {
        this.fundamental = copyFundamental(fundamental);
    }

    public SentimentAnalysis getSentiment() {
        return copySentiment(sentiment);
    }

    public void setSentiment(SentimentAnalysis sentiment) {
        this.sentiment = copySentiment(sentiment);
    }

    public List<KeyMetric> getKeyMetrics() {
        return CollectionCopyUtils.copyList(keyMetrics);
    }

    public void setKeyMetrics(List<KeyMetric> keyMetrics) {
        this.keyMetrics = CollectionCopyUtils.copyList(keyMetrics);
    }

    public List<RiskFactor> getRiskFactors() {
        return CollectionCopyUtils.copyList(riskFactors);
    }

    public void setRiskFactors(List<RiskFactor> riskFactors) {
        this.riskFactors = CollectionCopyUtils.copyList(riskFactors);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String analysis;
        private String provider;
        private String model;
        private String symbol;
        private String market;
        private String analysisType;
        private Integer overallScore;
        private String overallRating;
        private TechnicalAnalysis technical;
        private FundamentalAnalysis fundamental;
        private SentimentAnalysis sentiment;
        private String recommendation;
        private String reasoning;
        private List<KeyMetric> keyMetrics;
        private List<RiskFactor> riskFactors;
        private LocalDateTime generatedAt;

        public Builder analysis(String analysis) { this.analysis = analysis; return this; }
        public Builder provider(String provider) { this.provider = provider; return this; }
        public Builder model(String model) { this.model = model; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder market(String market) { this.market = market; return this; }
        public Builder analysisType(String analysisType) { this.analysisType = analysisType; return this; }
        public Builder overallScore(Integer overallScore) { this.overallScore = overallScore; return this; }
        public Builder overallRating(String overallRating) { this.overallRating = overallRating; return this; }
        public Builder technical(TechnicalAnalysis technical) { this.technical = copyTechnical(technical); return this; }
        public Builder fundamental(FundamentalAnalysis fundamental) { this.fundamental = copyFundamental(fundamental); return this; }
        public Builder sentiment(SentimentAnalysis sentiment) { this.sentiment = copySentiment(sentiment); return this; }
        public Builder recommendation(String recommendation) { this.recommendation = recommendation; return this; }
        public Builder reasoning(String reasoning) { this.reasoning = reasoning; return this; }
        public Builder keyMetrics(List<KeyMetric> keyMetrics) { this.keyMetrics = CollectionCopyUtils.copyList(keyMetrics); return this; }
        public Builder riskFactors(List<RiskFactor> riskFactors) { this.riskFactors = CollectionCopyUtils.copyList(riskFactors); return this; }
        public Builder generatedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; return this; }

        public StockAnalysisResponse build() {
            StockAnalysisResponse response = new StockAnalysisResponse();
            response.analysis = analysis;
            response.provider = provider;
            response.model = model;
            response.symbol = symbol;
            response.market = market;
            response.analysisType = analysisType;
            response.overallScore = overallScore;
            response.overallRating = overallRating;
            response.technical = copyTechnical(technical);
            response.fundamental = copyFundamental(fundamental);
            response.sentiment = copySentiment(sentiment);
            response.recommendation = recommendation;
            response.reasoning = reasoning;
            response.keyMetrics = CollectionCopyUtils.copyList(keyMetrics);
            response.riskFactors = CollectionCopyUtils.copyList(riskFactors);
            response.generatedAt = generatedAt;
            return response;
        }
    }

    private static TechnicalAnalysis copyTechnical(TechnicalAnalysis source) {
        if (source == null) {
            return null;
        }
        return TechnicalAnalysis.builder()
                .score(source.getScore())
                .trend(source.getTrend())
                .maSignal(source.getMaSignal())
                .macdSignal(source.getMacdSignal())
                .rsiSignal(source.getRsiSignal())
                .supportLevel(source.getSupportLevel())
                .resistanceLevel(source.getResistanceLevel())
                .build();
    }

    private static FundamentalAnalysis copyFundamental(FundamentalAnalysis source) {
        if (source == null) {
            return null;
        }
        return FundamentalAnalysis.builder()
                .score(source.getScore())
                .peEvaluation(source.getPeEvaluation())
                .pbEvaluation(source.getPbEvaluation())
                .profitability(source.getProfitability())
                .growthPotential(source.getGrowthPotential())
                .build();
    }

    private static SentimentAnalysis copySentiment(SentimentAnalysis source) {
        if (source == null) {
            return null;
        }
        return SentimentAnalysis.builder()
                .score(source.getScore())
                .marketSentiment(source.getMarketSentiment())
                .newsSentiment(source.getNewsSentiment())
                .socialSentiment(source.getSocialSentiment())
                .build();
    }

    /**
     * 
     */
    @Data
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

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private Integer score;
            private String trend;
            private String maSignal;
            private String macdSignal;
            private String rsiSignal;
            private String supportLevel;
            private String resistanceLevel;

            public Builder score(Integer score) { this.score = score; return this; }
            public Builder trend(String trend) { this.trend = trend; return this; }
            public Builder maSignal(String maSignal) { this.maSignal = maSignal; return this; }
            public Builder macdSignal(String macdSignal) { this.macdSignal = macdSignal; return this; }
            public Builder rsiSignal(String rsiSignal) { this.rsiSignal = rsiSignal; return this; }
            public Builder supportLevel(String supportLevel) { this.supportLevel = supportLevel; return this; }
            public Builder resistanceLevel(String resistanceLevel) { this.resistanceLevel = resistanceLevel; return this; }
            public TechnicalAnalysis build() { return new TechnicalAnalysis(score, trend, maSignal, macdSignal, rsiSignal, supportLevel, resistanceLevel); }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FundamentalAnalysis {
        private Integer score;
        private String peEvaluation;
        private String pbEvaluation;
        private String profitability;
        private String growthPotential;

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private Integer score;
            private String peEvaluation;
            private String pbEvaluation;
            private String profitability;
            private String growthPotential;
            public Builder score(Integer score) { this.score = score; return this; }
            public Builder peEvaluation(String peEvaluation) { this.peEvaluation = peEvaluation; return this; }
            public Builder pbEvaluation(String pbEvaluation) { this.pbEvaluation = pbEvaluation; return this; }
            public Builder profitability(String profitability) { this.profitability = profitability; return this; }
            public Builder growthPotential(String growthPotential) { this.growthPotential = growthPotential; return this; }
            public FundamentalAnalysis build() { return new FundamentalAnalysis(score, peEvaluation, pbEvaluation, profitability, growthPotential); }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentAnalysis {
        private Integer score;
        private String marketSentiment;
        private String newsSentiment;
        private String socialSentiment;

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private Integer score;
            private String marketSentiment;
            private String newsSentiment;
            private String socialSentiment;
            public Builder score(Integer score) { this.score = score; return this; }
            public Builder marketSentiment(String marketSentiment) { this.marketSentiment = marketSentiment; return this; }
            public Builder newsSentiment(String newsSentiment) { this.newsSentiment = newsSentiment; return this; }
            public Builder socialSentiment(String socialSentiment) { this.socialSentiment = socialSentiment; return this; }
            public SentimentAnalysis build() { return new SentimentAnalysis(score, marketSentiment, newsSentiment, socialSentiment); }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyMetric {
        private String name;
        private String value;
        private String interpretation;

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private String name;
            private String value;
            private String interpretation;
            public Builder name(String name) { this.name = name; return this; }
            public Builder value(String value) { this.value = value; return this; }
            public Builder interpretation(String interpretation) { this.interpretation = interpretation; return this; }
            public KeyMetric build() { return new KeyMetric(name, value, interpretation); }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskFactor {
        private String type;
        private String description;
        private String severity;

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private String type;
            private String description;
            private String severity;
            public Builder type(String type) { this.type = type; return this; }
            public Builder description(String description) { this.description = description; return this; }
            public Builder severity(String severity) { this.severity = severity; return this; }
            public RiskFactor build() { return new RiskFactor(type, description, severity); }
        }
    }
}
