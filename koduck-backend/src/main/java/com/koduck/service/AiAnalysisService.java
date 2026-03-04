package com.koduck.service;

import com.koduck.dto.ai.*;
import com.koduck.entity.BacktestResult;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Strategy;
import com.koduck.repository.BacktestResultRepository;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * AI 分析服务
 * 
 * 注：当前为模拟实现，实际项目中应调用 OpenAI/Claude 等 LLM API
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiAnalysisService {

    private final PortfolioPositionRepository positionRepository;
    private final StrategyRepository strategyRepository;
    private final BacktestResultRepository backtestResultRepository;
    private final Random random = new Random();

    /**
     * 股票智能分析
     */
    public StockAnalysisResponse analyzeStock(String symbol, String market, String analysisType) {
        log.debug("Analyzing stock: {}, market: {}, type: {}", symbol, market, analysisType);

        // 模拟 AI 分析结果
        int overallScore = 60 + random.nextInt(31); // 60-90
        String overallRating = overallScore >= 80 ? "买入" : overallScore >= 70 ? "持有" : "观望";

        return StockAnalysisResponse.builder()
            .symbol(symbol)
            .market(market)
            .analysisType(analysisType != null ? analysisType : "comprehensive")
            .overallScore(overallScore)
            .overallRating(overallRating)
            .technical(generateTechnicalAnalysis())
            .fundamental(generateFundamentalAnalysis())
            .sentiment(generateSentimentAnalysis())
            .recommendation(generateRecommendation(overallScore))
            .reasoning(generateReasoning(symbol, overallScore))
            .keyMetrics(generateKeyMetrics())
            .riskFactors(generateRiskFactors())
            .generatedAt(LocalDateTime.now())
            .build();
    }

    /**
     * 策略智能推荐
     */
    public StrategyRecommendResponse recommendStrategies(Long userId, StrategyRecommendRequest request) {
        log.debug("Recommending strategies for user: {}, risk: {}", userId, request.getRiskPreference());

        // 获取用户的策略
        List<Strategy> userStrategies = strategyRepository.findByUserId(userId);
        
        List<StrategyRecommendResponse.StrategyRecommendation> recommendations = new ArrayList<>();
        
        for (int i = 0; i < Math.min(3, userStrategies.size()); i++) {
            Strategy strategy = userStrategies.get(i);
            int matchScore = 70 + random.nextInt(26);
            
            recommendations.add(StrategyRecommendResponse.StrategyRecommendation.builder()
                .strategyId(strategy.getId())
                .strategyName(strategy.getName())
                .strategyType("MA_CROSS")
                .matchScore(matchScore)
                .matchReason(generateMatchReason(request.getRiskPreference()))
                .expectedReturn(generateExpectedReturn())
                .riskLevel(request.getRiskPreference())
                .suitableMarkets(List.of("US", "CN"))
                .build());
        }

        return StrategyRecommendResponse.builder()
            .riskProfile(request.getRiskPreference())
            .investmentHorizon(request.getInvestmentHorizon())
            .recommendations(recommendations)
            .assetAllocation(generateAssetAllocation(request.getRiskPreference()))
            .summary(generateRecommendationSummary(request.getRiskPreference()))
            .disclaimer("AI 建议仅供参考，投资需谨慎。")
            .generatedAt(LocalDateTime.now())
            .build();
    }

    /**
     * 回测结果解读
     */
    public BacktestInterpretResponse interpretBacktest(Long userId, Long backtestResultId) {
        log.debug("Interpreting backtest: {} for user: {}", backtestResultId, userId);

        BacktestResult result = backtestResultRepository.findByIdAndUserId(backtestResultId, userId)
            .orElseThrow(() -> new RuntimeException("Backtest result not found"));

        boolean isGoodPerformance = result.getTotalReturn().compareTo(new BigDecimal("0.1")) > 0;

        return BacktestInterpretResponse.builder()
            .backtestResultId(backtestResultId)
            .strategyName("策略 " + result.getStrategyId())
            .performance(generatePerformanceInterpretation(result, isGoodPerformance))
            .risk(generateRiskInterpretation(result))
            .tradingBehavior(generateTradingBehaviorAnalysis(result))
            .improvements(generateImprovementSuggestions(result))
            .overallAssessment(generateOverallAssessment(isGoodPerformance))
            .recommendation(isGoodPerformance ? "策略表现良好，可考虑实盘部署" : "策略需要优化后再考虑实盘")
            .generatedAt(LocalDateTime.now())
            .build();
    }

    /**
     * 风险评估
     */
    public RiskAssessmentResponse assessRisk(Long userId, Long portfolioId) {
        log.debug("Assessing risk for portfolio: {} of user: {}", portfolioId, userId);

        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        
        int overallScore = 40 + random.nextInt(41); // 40-80，分数越低风险越高
        String riskLevel = overallScore >= 70 ? "低风险" : overallScore >= 55 ? "中风险" : "高风险";

        return RiskAssessmentResponse.builder()
            .portfolioId(portfolioId)
            .overallRiskScore(overallScore)
            .overallRiskLevel(riskLevel)
            .riskLevelDescription(generateRiskDescription(overallScore))
            .riskBreakdown(generateRiskBreakdown())
            .metrics(generateRiskMetrics(positions.size()))
            .alerts(generateRiskAlerts(overallScore))
            .suggestions(generateRiskManagementSuggestions(overallScore))
            .generatedAt(LocalDateTime.now())
            .build();
    }

    // ========== 辅助方法 ==========

    private StockAnalysisResponse.TechnicalAnalysis generateTechnicalAnalysis() {
        return StockAnalysisResponse.TechnicalAnalysis.builder()
            .score(60 + random.nextInt(31))
            .trend(random.nextBoolean() ? "上升趋势" : "震荡整理")
            .maSignal(random.nextBoolean() ? "金叉" : "多头排列")
            .macdSignal(random.nextBoolean() ? " bullish" : "neutral")
            .rsiSignal("中性")
            .supportLevel("$" + (100 + random.nextInt(50)))
            .resistanceLevel("$" + (150 + random.nextInt(50)))
            .build();
    }

    private StockAnalysisResponse.FundamentalAnalysis generateFundamentalAnalysis() {
        return StockAnalysisResponse.FundamentalAnalysis.builder()
            .score(60 + random.nextInt(31))
            .peEvaluation(random.nextBoolean() ? "合理估值" : "略微高估")
            .pbEvaluation("合理")
            .profitability("良好")
            .growthPotential("中等")
            .build();
    }

    private StockAnalysisResponse.SentimentAnalysis generateSentimentAnalysis() {
        return StockAnalysisResponse.SentimentAnalysis.builder()
            .score(60 + random.nextInt(31))
            .marketSentiment(random.nextBoolean() ? "乐观" : "中性")
            .newsSentiment("正面")
            .socialSentiment("积极")
            .build();
    }

    private String generateRecommendation(int score) {
        if (score >= 80) return "强烈建议买入";
        if (score >= 70) return "建议买入";
        if (score >= 60) return "谨慎持有";
        return "建议观望";
    }

    private String generateReasoning(String symbol, int score) {
        return String.format(
            "%s 当前综合评分为 %d 分。从技术面看，股票处于%s；" +
            "基本面稳健，估值%s；市场情绪%s。建议%s。",
            symbol, score,
            score >= 70 ? "上升趋势" : "震荡整理",
            score >= 70 ? "合理" : "略高",
            score >= 70 ? "积极" : "中性",
            score >= 70 ? "关注买入机会" : "观望等待"
        );
    }

    private List<StockAnalysisResponse.KeyMetric> generateKeyMetrics() {
        return List.of(
            StockAnalysisResponse.KeyMetric.builder()
                .name("市盈率(PE)").value("25.3").interpretation("行业平均水平").build(),
            StockAnalysisResponse.KeyMetric.builder()
                .name("市净率(PB)").value("3.2").interpretation("合理区间").build(),
            StockAnalysisResponse.KeyMetric.builder()
                .name("ROE").value("15.6%").interpretation("盈利能力良好").build(),
            StockAnalysisResponse.KeyMetric.builder()
                .name("股息率").value("2.1%").interpretation("稳定的分红").build()
        );
    }

    private List<StockAnalysisResponse.RiskFactor> generateRiskFactors() {
        return List.of(
            StockAnalysisResponse.RiskFactor.builder()
                .type("市场风险").description("市场整体波动可能影响股价")
                .severity("中等").build(),
            StockAnalysisResponse.RiskFactor.builder()
                .type("行业风险").description("行业周期性波动")
                .severity("低").build()
        );
    }

    private String generateMatchReason(String riskPreference) {
        return switch (riskPreference) {
            case "conservative" -> "适合稳健型投资者，风险可控";
            case "aggressive" -> "追求高收益，适合激进型投资者";
            default -> "风险收益平衡，适合大多数投资者";
        };
    }

    private String generateExpectedReturn() {
        int min = 8 + random.nextInt(8);
        int max = min + 10 + random.nextInt(10);
        return min + "%-" + max + "%";
    }

    private StrategyRecommendResponse.AssetAllocationSuggestion generateAssetAllocation(String riskPreference) {
        List<StrategyRecommendResponse.AssetClass> classes = new ArrayList<>();
        
        switch (riskPreference) {
            case "conservative" -> {
                classes.add(new StrategyRecommendResponse.AssetClass("股票", 40, "稳健型股票"));
                classes.add(new StrategyRecommendResponse.AssetClass("债券", 50, "国债、企业债"));
                classes.add(new StrategyRecommendResponse.AssetClass("现金", 10, "货币基金"));
            }
            case "aggressive" -> {
                classes.add(new StrategyRecommendResponse.AssetClass("股票", 80, "成长型股票"));
                classes.add(new StrategyRecommendResponse.AssetClass("债券", 15, "高收益债"));
                classes.add(new StrategyRecommendResponse.AssetClass("现金", 5, "应急资金"));
            }
            default -> {
                classes.add(new StrategyRecommendResponse.AssetClass("股票", 60, "平衡配置"));
                classes.add(new StrategyRecommendResponse.AssetClass("债券", 35, "投资级债券"));
                classes.add(new StrategyRecommendResponse.AssetClass("现金", 5, "流动性管理"));
            }
        }
        
        return StrategyRecommendResponse.AssetAllocationSuggestion.builder()
            .assetClasses(classes)
            .rebalancingSuggestion("建议每季度检视一次资产配置")
            .build();
    }

    private String generateRecommendationSummary(String riskPreference) {
        return switch (riskPreference) {
            case "conservative" -> "基于您的保守风险偏好，建议优先选择稳健型策略，注重资本保护。";
            case "aggressive" -> "基于您的激进风险偏好，建议重点关注高收益策略，但需注意风险控制。";
            default -> "基于您的平衡风险偏好，建议采用多元化策略组合，平衡风险与收益。";
        };
    }

    private BacktestInterpretResponse.PerformanceInterpretation generatePerformanceInterpretation(
            BacktestResult result, boolean isGood) {
        return BacktestInterpretResponse.PerformanceInterpretation.builder()
            .totalReturnAssessment(isGood ? "优秀" : "一般")
            .annualizedReturnAssessment(isGood ? "超越大盘" : "持平大盘")
            .benchmarkComparison(isGood ? "跑赢基准指数" : "与基准持平")
            .consistencyEvaluation("收益稳定性" + (isGood ? "良好" : "一般"))
            .build();
    }

    private BacktestInterpretResponse.RiskInterpretation generateRiskInterpretation(BacktestResult result) {
        return BacktestInterpretResponse.RiskInterpretation.builder()
            .maxDrawdownAssessment(result.getMaxDrawdown() != null && result.getMaxDrawdown().compareTo(new BigDecimal("0.15")) < 0 ? "可控" : "较高")
            .volatilityAssessment("中等波动")
            .sharpeRatioAssessment(result.getSharpeRatio() != null && result.getSharpeRatio().compareTo(new BigDecimal("1.0")) > 0 ? "良好" : "一般")
            .riskAdjustedReturn("风险调整后收益" + (result.getSharpeRatio().compareTo(new BigDecimal("1")) > 0 ? "优秀" : "一般"))
            .build();
    }

    private BacktestInterpretResponse.TradingBehaviorAnalysis generateTradingBehaviorAnalysis(BacktestResult result) {
        return BacktestInterpretResponse.TradingBehaviorAnalysis.builder()
            .winRateAnalysis("胜率" + result.getWinRate() + "%，" + (result.getWinRate().compareTo(new BigDecimal("50")) > 0 ? "正向优势" : "需优化"))
            .profitFactorAnalysis("盈亏比健康，策略可持续")
            .tradeFrequencyAssessment("交易频率适中")
            .timingEvaluation("入场时机把握较好")
            .build();
    }

    private List<BacktestInterpretResponse.ImprovementSuggestion> generateImprovementSuggestions(BacktestResult result) {
        List<BacktestInterpretResponse.ImprovementSuggestion> suggestions = new ArrayList<>();
        
        if (result.getWinRate() != null && result.getWinRate().compareTo(new BigDecimal("55")) < 0) {
            suggestions.add(BacktestInterpretResponse.ImprovementSuggestion.builder()
                .category("信号优化")
                .suggestion("优化入场信号，提高胜率")
                .expectedImpact("胜率提升 5-10%")
                .priority("高")
                .build());
        }
        
        if (result.getMaxDrawdown() != null && result.getMaxDrawdown().compareTo(new BigDecimal("0.15")) > 0) {
            suggestions.add(BacktestInterpretResponse.ImprovementSuggestion.builder()
                .category("风险控制")
                .suggestion("增加止损机制，控制最大回撤")
                .expectedImpact("回撤降低 3-5%")
                .priority("高")
                .build());
        }
        
        suggestions.add(BacktestInterpretResponse.ImprovementSuggestion.builder()
            .category("参数优化")
            .suggestion("使用遗传算法优化策略参数")
            .expectedImpact("收益提升 2-5%")
            .priority("中")
            .build());
        
        return suggestions;
    }

    private String generateOverallAssessment(boolean isGood) {
        return isGood 
            ? "该策略在历史回测中表现优秀，各项指标均达到预期目标。"
            : "该策略在历史回测中表现一般，建议根据改进建议进行优化后再考虑实盘。";
    }

    private String generateRiskDescription(int score) {
        if (score >= 70) return "您的投资组合风险较低，配置较为稳健。";
        if (score >= 55) return "您的投资组合风险适中，需注意个别持仓的集中度。";
        return "您的投资组合风险较高，建议适当分散投资或增加避险资产。";
    }

    private RiskAssessmentResponse.RiskBreakdown generateRiskBreakdown() {
        return RiskAssessmentResponse.RiskBreakdown.builder()
            .marketRisk(60 + random.nextInt(21))
            .concentrationRisk(50 + random.nextInt(31))
            .volatilityRisk(55 + random.nextInt(26))
            .liquidityRisk(70 + random.nextInt(21))
            .currencyRisk(65 + random.nextInt(21))
            .build();
    }

    private List<RiskAssessmentResponse.RiskMetric> generateRiskMetrics(int positionCount) {
        return List.of(
            RiskAssessmentResponse.RiskMetric.builder()
                .name("持仓集中度").value(positionCount < 5 ? "高" : "适中")
                .benchmark("5-10只").assessment(positionCount < 5 ? "需分散" : "合理").build(),
            RiskAssessmentResponse.RiskMetric.builder()
                .name("行业分散度").value("良好").benchmark("3+行业").assessment("符合标准").build(),
            RiskAssessmentResponse.RiskMetric.builder()
                .name("单股占比").value("<15%").benchmark("<20%").assessment("安全").build()
        );
    }

    private List<RiskAssessmentResponse.RiskAlert> generateRiskAlerts(int overallScore) {
        List<RiskAssessmentResponse.RiskAlert> alerts = new ArrayList<>();
        
        if (overallScore < 60) {
            alerts.add(RiskAssessmentResponse.RiskAlert.builder()
                .type("集中度风险").severity("高")
                .message("个别持仓占比过高")
                .suggestion("建议分散投资，单股占比不超过20%")
                .build());
        }
        
        if (random.nextBoolean()) {
            alerts.add(RiskAssessmentResponse.RiskAlert.builder()
                .type("市场风险").severity("中")
                .message("当前市场波动较大")
                .suggestion("考虑增加避险资产或降低仓位")
                .build());
        }
        
        return alerts;
    }

    private List<RiskAssessmentResponse.RiskManagementSuggestion> generateRiskManagementSuggestions(int overallScore) {
        List<RiskAssessmentResponse.RiskManagementSuggestion> suggestions = new ArrayList<>();
        
        suggestions.add(RiskAssessmentResponse.RiskManagementSuggestion.builder()
            .category("资产配置")
            .action("增加债券或货币基金比例")
            .expectedBenefit("降低组合波动")
            .priority(overallScore < 60 ? "高" : "中")
            .build());
        
        suggestions.add(RiskAssessmentResponse.RiskManagementSuggestion.builder()
            .category("止损策略")
            .action("为个股设置8-10%止损线")
            .expectedBenefit("控制最大回撤")
            .priority("高")
            .build());
        
        return suggestions;
    }
}
