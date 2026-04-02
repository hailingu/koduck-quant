package com.koduck.dto.ai;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

/**
 * 股票分析响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class StockAnalysisResponse {

    /**
     * 分析内容。
     */
    private String analysis;

    /**
     * 提供商。
     */
    private String provider;

    /**
     * 模型。
     */
    private String model;

    /**
     * 股票代码。
     */
    private String symbol;

    /**
     * 市场。
     */
    private String market;

    /**
     * 分析类型。
     */
    private String analysisType;

    /**
     * 综合评分。
     */
    private Integer overallScore;

    /**
     * 综合评级。
     */
    private String overallRating;

    /**
     * 技术分析。
     */
    private TechnicalAnalysis technical;

    /**
     * 基本面分析。
     */
    private FundamentalAnalysis fundamental;

    /**
     * 情绪分析。
     */
    private SentimentAnalysis sentiment;

    /**
     * 推荐建议。
     */
    private String recommendation;

    /**
     * 推理依据。
     */
    private String reasoning;

    /**
     * 关键指标列表。
     */
    private List<KeyMetric> keyMetrics;

    /**
     * 风险因素列表。
     */
    private List<RiskFactor> riskFactors;

    /**
     * 生成时间。
     */
    private LocalDateTime generatedAt;

    /**
     * 获取技术分析的副本。
     *
     * @return 技术分析副本
     */
    public TechnicalAnalysis getTechnical() {
        return copyTechnical(technical);
    }

    /**
     * 设置技术分析。
     *
     * @param technical 技术分析
     */
    public void setTechnical(TechnicalAnalysis technical) {
        this.technical = copyTechnical(technical);
    }

    /**
     * 获取基本面分析的副本。
     *
     * @return 基本面分析副本
     */
    public FundamentalAnalysis getFundamental() {
        return copyFundamental(fundamental);
    }

    /**
     * 设置基本面分析。
     *
     * @param fundamental 基本面分析
     */
    public void setFundamental(FundamentalAnalysis fundamental) {
        this.fundamental = copyFundamental(fundamental);
    }

    /**
     * 获取情绪分析的副本。
     *
     * @return 情绪分析副本
     */
    public SentimentAnalysis getSentiment() {
        return copySentiment(sentiment);
    }

    /**
     * 设置情绪分析。
     *
     * @param sentiment 情绪分析
     */
    public void setSentiment(SentimentAnalysis sentiment) {
        this.sentiment = copySentiment(sentiment);
    }

    /**
     * 获取关键指标列表的副本。
     *
     * @return 关键指标列表副本
     */
    public List<KeyMetric> getKeyMetrics() {
        return CollectionCopyUtils.copyList(keyMetrics);
    }

    /**
     * 设置关键指标列表。
     *
     * @param keyMetrics 关键指标列表
     */
    public void setKeyMetrics(List<KeyMetric> keyMetrics) {
        this.keyMetrics = CollectionCopyUtils.copyList(keyMetrics);
    }

    /**
     * 获取风险因素列表的副本。
     *
     * @return 风险因素列表副本
     */
    public List<RiskFactor> getRiskFactors() {
        return CollectionCopyUtils.copyList(riskFactors);
    }

    /**
     * 设置风险因素列表。
     *
     * @param riskFactors 风险因素列表
     */
    public void setRiskFactors(List<RiskFactor> riskFactors) {
        this.riskFactors = CollectionCopyUtils.copyList(riskFactors);
    }

    /**
     * 获取 Builder 实例。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder 类。
     */
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

        /**
         * 设置分析内容。
         *
         * @param analysis 分析内容
         * @return Builder 实例
         */
        public Builder analysis(String analysis) {
            this.analysis = analysis;
            return this;
        }

        /**
         * 设置提供商。
         *
         * @param provider 提供商
         * @return Builder 实例
         */
        public Builder provider(String provider) {
            this.provider = provider;
            return this;
        }

        /**
         * 设置模型。
         *
         * @param model 模型
         * @return Builder 实例
         */
        public Builder model(String model) {
            this.model = model;
            return this;
        }

        /**
         * 设置股票代码。
         *
         * @param symbol 股票代码
         * @return Builder 实例
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * 设置市场。
         *
         * @param market 市场
         * @return Builder 实例
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * 设置分析类型。
         *
         * @param analysisType 分析类型
         * @return Builder 实例
         */
        public Builder analysisType(String analysisType) {
            this.analysisType = analysisType;
            return this;
        }

        /**
         * 设置综合评分。
         *
         * @param overallScore 综合评分
         * @return Builder 实例
         */
        public Builder overallScore(Integer overallScore) {
            this.overallScore = overallScore;
            return this;
        }

        /**
         * 设置综合评级。
         *
         * @param overallRating 综合评级
         * @return Builder 实例
         */
        public Builder overallRating(String overallRating) {
            this.overallRating = overallRating;
            return this;
        }

        /**
         * 设置技术分析。
         *
         * @param technical 技术分析
         * @return Builder 实例
         */
        public Builder technical(TechnicalAnalysis technical) {
            this.technical = copyTechnical(technical);
            return this;
        }

        /**
         * 设置基本面分析。
         *
         * @param fundamental 基本面分析
         * @return Builder 实例
         */
        public Builder fundamental(FundamentalAnalysis fundamental) {
            this.fundamental = copyFundamental(fundamental);
            return this;
        }

        /**
         * 设置情绪分析。
         *
         * @param sentiment 情绪分析
         * @return Builder 实例
         */
        public Builder sentiment(SentimentAnalysis sentiment) {
            this.sentiment = copySentiment(sentiment);
            return this;
        }

        /**
         * 设置推荐建议。
         *
         * @param recommendation 推荐建议
         * @return Builder 实例
         */
        public Builder recommendation(String recommendation) {
            this.recommendation = recommendation;
            return this;
        }

        /**
         * 设置推理依据。
         *
         * @param reasoning 推理依据
         * @return Builder 实例
         */
        public Builder reasoning(String reasoning) {
            this.reasoning = reasoning;
            return this;
        }

        /**
         * 设置关键指标列表。
         *
         * @param keyMetrics 关键指标列表
         * @return Builder 实例
         */
        public Builder keyMetrics(List<KeyMetric> keyMetrics) {
            this.keyMetrics = CollectionCopyUtils.copyList(keyMetrics);
            return this;
        }

        /**
         * 设置风险因素列表。
         *
         * @param riskFactors 风险因素列表
         * @return Builder 实例
         */
        public Builder riskFactors(List<RiskFactor> riskFactors) {
            this.riskFactors = CollectionCopyUtils.copyList(riskFactors);
            return this;
        }

        /**
         * 设置生成时间。
         *
         * @param generatedAt 生成时间
         * @return Builder 实例
         */
        public Builder generatedAt(LocalDateTime generatedAt) {
            this.generatedAt = generatedAt;
            return this;
        }

        /**
         * 构建响应对象。
         *
         * @return StockAnalysisResponse 实例
         */
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

    /**
     * 复制技术分析对象。
     *
     * @param source 源对象
     * @return 副本
     */
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

    /**
     * 复制基本面分析对象。
     *
     * @param source 源对象
     * @return 副本
     */
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

    /**
     * 复制情绪分析对象。
     *
     * @param source 源对象
     * @return 副本
     */
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
     * 技术分析。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechnicalAnalysis {

        /**
         * 评分。
         */
        private Integer score;

        /**
         * 趋势。
         */
        private String trend;

        /**
         * 均线信号。
         */
        private String maSignal;

        /**
         * MACD信号。
         */
        private String macdSignal;

        /**
         * RSI信号。
         */
        private String rsiSignal;

        /**
         * 支撑位。
         */
        private String supportLevel;

        /**
         * 阻力位。
         */
        private String resistanceLevel;

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private Integer score;
            private String trend;
            private String maSignal;
            private String macdSignal;
            private String rsiSignal;
            private String supportLevel;
            private String resistanceLevel;

            /**
             * 设置评分。
             *
             * @param score 评分
             * @return Builder 实例
             */
            public Builder score(Integer score) {
                this.score = score;
                return this;
            }

            /**
             * 设置趋势。
             *
             * @param trend 趋势
             * @return Builder 实例
             */
            public Builder trend(String trend) {
                this.trend = trend;
                return this;
            }

            /**
             * 设置均线信号。
             *
             * @param maSignal 均线信号
             * @return Builder 实例
             */
            public Builder maSignal(String maSignal) {
                this.maSignal = maSignal;
                return this;
            }

            /**
             * 设置MACD信号。
             *
             * @param macdSignal MACD信号
             * @return Builder 实例
             */
            public Builder macdSignal(String macdSignal) {
                this.macdSignal = macdSignal;
                return this;
            }

            /**
             * 设置RSI信号。
             *
             * @param rsiSignal RSI信号
             * @return Builder 实例
             */
            public Builder rsiSignal(String rsiSignal) {
                this.rsiSignal = rsiSignal;
                return this;
            }

            /**
             * 设置支撑位。
             *
             * @param supportLevel 支撑位
             * @return Builder 实例
             */
            public Builder supportLevel(String supportLevel) {
                this.supportLevel = supportLevel;
                return this;
            }

            /**
             * 设置阻力位。
             *
             * @param resistanceLevel 阻力位
             * @return Builder 实例
             */
            public Builder resistanceLevel(String resistanceLevel) {
                this.resistanceLevel = resistanceLevel;
                return this;
            }

            /**
             * 构建技术分析对象。
             *
             * @return TechnicalAnalysis 实例
             */
            public TechnicalAnalysis build() {
                return new TechnicalAnalysis(
                        score,
                        trend,
                        maSignal,
                        macdSignal,
                        rsiSignal,
                        supportLevel,
                        resistanceLevel
                );
            }
        }
    }

    /**
     * 基本面分析。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FundamentalAnalysis {

        /**
         * 评分。
         */
        private Integer score;

        /**
         * 市盈率评估。
         */
        private String peEvaluation;

        /**
         * 市净率评估。
         */
        private String pbEvaluation;

        /**
         * 盈利能力。
         */
        private String profitability;

        /**
         * 增长潜力。
         */
        private String growthPotential;

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private Integer score;
            private String peEvaluation;
            private String pbEvaluation;
            private String profitability;
            private String growthPotential;

            /**
             * 设置评分。
             *
             * @param score 评分
             * @return Builder 实例
             */
            public Builder score(Integer score) {
                this.score = score;
                return this;
            }

            /**
             * 设置市盈率评估。
             *
             * @param peEvaluation 市盈率评估
             * @return Builder 实例
             */
            public Builder peEvaluation(String peEvaluation) {
                this.peEvaluation = peEvaluation;
                return this;
            }

            /**
             * 设置市净率评估。
             *
             * @param pbEvaluation 市净率评估
             * @return Builder 实例
             */
            public Builder pbEvaluation(String pbEvaluation) {
                this.pbEvaluation = pbEvaluation;
                return this;
            }

            /**
             * 设置盈利能力。
             *
             * @param profitability 盈利能力
             * @return Builder 实例
             */
            public Builder profitability(String profitability) {
                this.profitability = profitability;
                return this;
            }

            /**
             * 设置增长潜力。
             *
             * @param growthPotential 增长潜力
             * @return Builder 实例
             */
            public Builder growthPotential(String growthPotential) {
                this.growthPotential = growthPotential;
                return this;
            }

            /**
             * 构建基本面分析对象。
             *
             * @return FundamentalAnalysis 实例
             */
            public FundamentalAnalysis build() {
                return new FundamentalAnalysis(
                        score,
                        peEvaluation,
                        pbEvaluation,
                        profitability,
                        growthPotential
                );
            }
        }
    }

    /**
     * 情绪分析。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentAnalysis {

        /**
         * 评分。
         */
        private Integer score;

        /**
         * 市场情绪。
         */
        private String marketSentiment;

        /**
         * 新闻情绪。
         */
        private String newsSentiment;

        /**
         * 社交情绪。
         */
        private String socialSentiment;

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private Integer score;
            private String marketSentiment;
            private String newsSentiment;
            private String socialSentiment;

            /**
             * 设置评分。
             *
             * @param score 评分
             * @return Builder 实例
             */
            public Builder score(Integer score) {
                this.score = score;
                return this;
            }

            /**
             * 设置市场情绪。
             *
             * @param marketSentiment 市场情绪
             * @return Builder 实例
             */
            public Builder marketSentiment(String marketSentiment) {
                this.marketSentiment = marketSentiment;
                return this;
            }

            /**
             * 设置新闻情绪。
             *
             * @param newsSentiment 新闻情绪
             * @return Builder 实例
             */
            public Builder newsSentiment(String newsSentiment) {
                this.newsSentiment = newsSentiment;
                return this;
            }

            /**
             * 设置社交情绪。
             *
             * @param socialSentiment 社交情绪
             * @return Builder 实例
             */
            public Builder socialSentiment(String socialSentiment) {
                this.socialSentiment = socialSentiment;
                return this;
            }

            /**
             * 构建情绪分析对象。
             *
             * @return SentimentAnalysis 实例
             */
            public SentimentAnalysis build() {
                return new SentimentAnalysis(
                        score,
                        marketSentiment,
                        newsSentiment,
                        socialSentiment
                );
            }
        }
    }

    /**
     * 关键指标。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyMetric {

        /**
         * 名称。
         */
        private String name;

        /**
         * 值。
         */
        private String value;

        /**
         * 解读。
         */
        private String interpretation;

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private String name;
            private String value;
            private String interpretation;

            /**
             * 设置名称。
             *
             * @param name 名称
             * @return Builder 实例
             */
            public Builder name(String name) {
                this.name = name;
                return this;
            }

            /**
             * 设置值。
             *
             * @param value 值
             * @return Builder 实例
             */
            public Builder value(String value) {
                this.value = value;
                return this;
            }

            /**
             * 设置解读。
             *
             * @param interpretation 解读
             * @return Builder 实例
             */
            public Builder interpretation(String interpretation) {
                this.interpretation = interpretation;
                return this;
            }

            /**
             * 构建关键指标对象。
             *
             * @return KeyMetric 实例
             */
            public KeyMetric build() {
                return new KeyMetric(name, value, interpretation);
            }
        }
    }

    /**
     * 风险因素。
     *
     * @author Koduck Team
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskFactor {

        /**
         * 类型。
         */
        private String type;

        /**
         * 描述。
         */
        private String description;

        /**
         * 严重级别。
         */
        private String severity;

        /**
         * 获取 Builder 实例。
         *
         * @return Builder 实例
         */
        public static Builder builder() {
            return new Builder();
        }

        /**
         * Builder 类。
         */
        public static final class Builder {

            private String type;
            private String description;
            private String severity;

            /**
             * 设置类型。
             *
             * @param type 类型
             * @return Builder 实例
             */
            public Builder type(String type) {
                this.type = type;
                return this;
            }

            /**
             * 设置描述。
             *
             * @param description 描述
             * @return Builder 实例
             */
            public Builder description(String description) {
                this.description = description;
                return this;
            }

            /**
             * 设置严重级别。
             *
             * @param severity 严重级别
             * @return Builder 实例
             */
            public Builder severity(String severity) {
                this.severity = severity;
                return this;
            }

            /**
             * 构建风险因素对象。
             *
             * @return RiskFactor 实例
             */
            public RiskFactor build() {
                return new RiskFactor(type, description, severity);
            }
        }
    }
}
