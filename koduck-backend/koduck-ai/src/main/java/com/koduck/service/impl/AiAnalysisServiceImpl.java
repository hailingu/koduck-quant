package com.koduck.service.impl;

import com.koduck.ai.dto.PortfolioOptimizationSuggestion;
import com.koduck.ai.dto.PortfolioRiskAssessment;
import com.koduck.portfolio.api.acl.PortfolioQueryService;
import com.koduck.portfolio.dto.PortfolioSnapshot;
import com.koduck.portfolio.dto.PortfolioSnapshot.PositionSnapshot;
import com.koduck.service.AiAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * AI 分析服务实现 - 通过 Portfolio ACL 接口访问投资组合数据。
 *
 * <p>本实现演示了如何通过 {@link PortfolioQueryService} ACL 接口获取投资组合数据，
 * 而不直接依赖 Portfolio 模块的内部 Repository 或实体类。</p>
 *
 * @author Koduck AI Team
 * @since 0.1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiAnalysisServiceImpl implements AiAnalysisService {

    /** Portfolio ACL 接口 - 用于查询投资组合数据 */
    private final PortfolioQueryService portfolioQueryService;

    // 风险阈值常量
    private static final BigDecimal HIGH_CONCENTRATION_THRESHOLD = new BigDecimal("0.30");
    private static final BigDecimal MEDIUM_CONCENTRATION_THRESHOLD = new BigDecimal("0.20");
    private static final BigDecimal HIGH_VOLATILITY_THRESHOLD = new BigDecimal("0.25");
    private static final BigDecimal MEDIUM_VOLATILITY_THRESHOLD = new BigDecimal("0.15");

    @Override
    public Optional<PortfolioRiskAssessment> assessPortfolioRisk(Long portfolioId) {
        log.info("Assessing risk for portfolio: {}", portfolioId);

        // 通过 ACL 接口获取投资组合快照
        Optional<PortfolioSnapshot> snapshotOpt = portfolioQueryService.getSnapshot(portfolioId);
        if (snapshotOpt.isEmpty()) {
            log.warn("Portfolio not found: {}", portfolioId);
            return Optional.empty();
        }

        PortfolioSnapshot snapshot = snapshotOpt.get();

        // 计算各项风险指标
        BigDecimal concentrationRisk = calculateConcentrationRiskScore(snapshot);
        BigDecimal volatilityRisk = estimateVolatilityRisk(snapshot);
        BigDecimal overallRisk = calculateOverallRisk(concentrationRisk, volatilityRisk);

        // 构建风险评估结果
        PortfolioRiskAssessment assessment = PortfolioRiskAssessment.builder()
                .portfolioId(snapshot.portfolioId())
                .portfolioName(snapshot.portfolioName())
                .overallRiskScore(overallRisk)
                .riskLevel(determineRiskLevel(overallRisk))
                .concentrationRisk(concentrationRisk)
                .volatilityRisk(volatilityRisk)
                .sectorRisks(analyzeSectorRisks(snapshot))
                .suggestions(generateRiskSuggestions(snapshot, concentrationRisk))
                .build();

        log.info("Risk assessment completed for portfolio: {}, overall risk: {}",
                portfolioId, overallRisk);
        return Optional.of(assessment);
    }

    @Override
    public Optional<String> analyzePortfolioReturns(Long portfolioId) {
        log.info("Analyzing returns for portfolio: {}", portfolioId);

        Optional<PortfolioSnapshot> snapshotOpt = portfolioQueryService.getSnapshot(portfolioId);
        if (snapshotOpt.isEmpty()) {
            return Optional.empty();
        }

        PortfolioSnapshot snapshot = snapshotOpt.get();

        // 构建收益分析文本
        String ls = System.lineSeparator();
        StringBuilder analysis = new StringBuilder();
        analysis.append("投资组合 '").append(snapshot.portfolioName()).append("' 收益分析:").append(ls);
        analysis.append("- 总市值: ").append(snapshot.totalValue()).append(ls);
        analysis.append("- 总成本: ").append(snapshot.totalCost()).append(ls);
        analysis.append("- 总收益: ").append(snapshot.totalReturn()).append(ls);
        analysis.append("- 收益率: ")
                .append(snapshot.totalReturnPercent().multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP))
                .append("%")
                .append(ls);

        // 添加持仓贡献分析
        analysis.append(ls).append("主要持仓贡献:").append(ls);
        snapshot.positions().stream()
                .sorted(Comparator.comparing(PositionSnapshot::marketValue).reversed())
                .limit(5)
                .forEach(pos -> {
                    BigDecimal weight = pos.marketValue()
                            .divide(snapshot.totalValue(), 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100"));
                    analysis.append("- ").append(pos.symbol()).append(": ")
                            .append(pos.marketValue())
                            .append(" (占比 ")
                            .append(weight.setScale(2, RoundingMode.HALF_UP))
                            .append("%)")
                            .append(ls);
                });

        return Optional.of(analysis.toString());
    }

    @Override
    public Optional<List<PortfolioOptimizationSuggestion>> suggestOptimizations(Long portfolioId) {
        log.info("Generating optimization suggestions for portfolio: {}", portfolioId);

        Optional<PortfolioSnapshot> snapshotOpt = portfolioQueryService.getSnapshot(portfolioId);
        if (snapshotOpt.isEmpty()) {
            return Optional.empty();
        }

        PortfolioSnapshot snapshot = snapshotOpt.get();
        List<PortfolioOptimizationSuggestion> suggestions = new ArrayList<>();

        // 检查集中度风险
        BigDecimal maxPositionWeight = calculateMaxPositionWeight(snapshot);
        if (maxPositionWeight.compareTo(HIGH_CONCENTRATION_THRESHOLD) > 0) {
            PositionSnapshot largestPos = findLargestPosition(snapshot);
            suggestions.add(PortfolioOptimizationSuggestion.builder()
                    .type(PortfolioOptimizationSuggestion.SuggestionType.DIVERSIFICATION)
                    .priority(5)
                    .title("持仓过于集中")
                    .description(String.format("'%s' 占投资组合的 %.1f%%，建议适当分散以降低风险",
                            largestPos.symbol(),
                            maxPositionWeight.multiply(new BigDecimal("100"))))
                    .expectedImpact("降低集中度风险，提高组合稳定性")
                    .relatedSymbol(largestPos.symbol())
                    .build());
        }

        // 检查是否需要再平衡（假设单个持仓超过 25% 需要关注）
        snapshot.positions().stream()
                .filter(pos -> pos.marketValue()
                        .divide(snapshot.totalValue(), 4, RoundingMode.HALF_UP)
                        .compareTo(new BigDecimal("0.25")) > 0)
                .forEach(pos -> suggestions.add(PortfolioOptimizationSuggestion.builder()
                        .type(PortfolioOptimizationSuggestion.SuggestionType.REBALANCING)
                        .priority(4)
                        .title(String.format("'%s' 持仓比例过高", pos.symbol()))
                        .description("该持仓占投资组合比例超过 25%，建议考虑再平衡")
                        .expectedImpact("优化资产配置，符合目标风险水平")
                        .relatedSymbol(pos.symbol())
                        .build()));

        // 添加通用建议
        if (snapshot.positions().size() < 5) {
            suggestions.add(PortfolioOptimizationSuggestion.builder()
                    .type(PortfolioOptimizationSuggestion.SuggestionType.DIVERSIFICATION)
                    .priority(3)
                    .title("持仓数量较少")
                    .description(String.format("当前仅持有 %d 只股票，建议增加持仓数量以分散风险",
                            snapshot.positions().size()))
                    .expectedImpact("通过分散化降低非系统性风险")
                    .build());
        }

        // 按优先级排序
        suggestions.sort(Comparator.comparing(PortfolioOptimizationSuggestion::getPriority).reversed());

        return Optional.of(suggestions);
    }

    @Override
    public double calculateConcentrationRisk(PortfolioSnapshot snapshot) {
        return calculateConcentrationRiskScore(snapshot).doubleValue();
    }

    @Override
    public String analyzeSectorDistribution(PortfolioSnapshot snapshot) {
        // 简化版本：基于持仓数量模拟行业分布
        // 实际实现中应该通过 Market ACL 获取股票行业信息
        int positionCount = snapshot.positions().size();

        if (positionCount <= 3) {
            return "持仓高度集中，行业分散度低，建议增加不同行业的投资标的。";
        } else if (positionCount <= 8) {
            return "持仓适度分散，建议关注各行业权重分配是否均衡。";
        } else {
            return "持仓较为分散，行业风险得到较好控制。";
        }
    }

    // ============ 私有辅助方法 ============

    /**
     * 计算集中度风险评分。
     */
    private BigDecimal calculateConcentrationRiskScore(PortfolioSnapshot snapshot) {
        if (snapshot.positions().isEmpty()) {
            return BigDecimal.ZERO;
        }

        // 计算赫芬达尔指数 (HHI) 作为集中度指标
        BigDecimal hhi = snapshot.positions().stream()
                .map(pos -> {
                    BigDecimal weight = pos.marketValue()
                            .divide(snapshot.totalValue(), 4, RoundingMode.HALF_UP);
                    return weight.multiply(weight);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 将 HHI 转换为 0-100 的风险评分
        // HHI 范围：1/n (完全分散) 到 1 (完全集中)
        // 转换为风险评分：越接近 1 风险越高
        return hhi.multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 估算波动率风险（简化版本）。
     */
    private BigDecimal estimateVolatilityRisk(PortfolioSnapshot snapshot) {
        // 简化估算：基于持仓数量和集中度估算
        // 实际实现应该通过历史数据计算
        int positionCount = snapshot.positions().size();
        BigDecimal baseRisk = new BigDecimal("0.20"); // 基础风险 20%

        // 持仓越少，风险越高
        BigDecimal diversificationFactor = BigDecimal.ONE
                .divide(new BigDecimal(Math.max(positionCount, 1)), 4, RoundingMode.HALF_UP);

        return baseRisk.multiply(BigDecimal.ONE.subtract(diversificationFactor))
                .multiply(new BigDecimal("100"))
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 计算整体风险评分。
     */
    private BigDecimal calculateOverallRisk(BigDecimal concentrationRisk, BigDecimal volatilityRisk) {
        // 简单加权平均
        return concentrationRisk.multiply(new BigDecimal("0.4"))
                .add(volatilityRisk.multiply(new BigDecimal("0.6")))
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 确定风险等级。
     */
    private PortfolioRiskAssessment.RiskLevel determineRiskLevel(BigDecimal riskScore) {
        if (riskScore.compareTo(new BigDecimal("70")) >= 0) {
            return PortfolioRiskAssessment.RiskLevel.EXTREME;
        } else if (riskScore.compareTo(new BigDecimal("50")) >= 0) {
            return PortfolioRiskAssessment.RiskLevel.HIGH;
        } else if (riskScore.compareTo(new BigDecimal("30")) >= 0) {
            return PortfolioRiskAssessment.RiskLevel.MEDIUM;
        }
        return PortfolioRiskAssessment.RiskLevel.LOW;
    }

    /**
     * 分析行业风险（简化版本）。
     */
    private List<PortfolioRiskAssessment.SectorRisk> analyzeSectorRisks(PortfolioSnapshot snapshot) {
        // 简化实现：将每个持仓视为一个"行业"
        // 实际实现应该通过 Market ACL 获取真实行业信息
        return snapshot.positions().stream()
                .map(pos -> {
                    BigDecimal weight = pos.marketValue()
                            .divide(snapshot.totalValue(), 4, RoundingMode.HALF_UP);
                    PortfolioRiskAssessment.RiskLevel level =
                            weight.compareTo(HIGH_CONCENTRATION_THRESHOLD) > 0
                                    ? PortfolioRiskAssessment.RiskLevel.HIGH
                                    : weight.compareTo(MEDIUM_CONCENTRATION_THRESHOLD) > 0
                                            ? PortfolioRiskAssessment.RiskLevel.MEDIUM
                                            : PortfolioRiskAssessment.RiskLevel.LOW;

                    return PortfolioRiskAssessment.SectorRisk.builder()
                            .sector(pos.symbol() + " (模拟行业)")
                            .exposurePercent(weight.multiply(new BigDecimal("100")))
                            .level(level)
                            .comment(level == PortfolioRiskAssessment.RiskLevel.HIGH
                                    ? "持仓占比过高，建议分散"
                                    : "风险可控")
                            .build();
                })
                .sorted(Comparator.comparing(PortfolioRiskAssessment.SectorRisk::getExposurePercent).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }

    /**
     * 生成风险建议。
     */
    private List<String> generateRiskSuggestions(PortfolioSnapshot snapshot, BigDecimal concentrationRisk) {
        List<String> suggestions = new ArrayList<>();

        if (concentrationRisk.compareTo(new BigDecimal("50")) > 0) {
            suggestions.add("持仓集中度较高，建议适当分散投资以降低风险");
        }

        if (snapshot.positions().size() < 5) {
            suggestions.add("持仓数量较少，建议增加投资标的数量");
        }

        BigDecimal returnPercent = snapshot.totalReturnPercent();
        if (returnPercent.compareTo(new BigDecimal("-0.10")) < 0) {
            suggestions.add("当前投资组合处于亏损状态，建议审慎评估持仓标的");
        }

        if (suggestions.isEmpty()) {
            suggestions.add("当前投资组合风险可控，建议定期关注市场变化");
        }

        return suggestions;
    }

    /**
     * 计算最大持仓权重。
     */
    private BigDecimal calculateMaxPositionWeight(PortfolioSnapshot snapshot) {
        return snapshot.positions().stream()
                .map(pos -> pos.marketValue()
                        .divide(snapshot.totalValue(), 4, RoundingMode.HALF_UP))
                .max(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);
    }

    /**
     * 找到最大持仓。
     */
    private PositionSnapshot findLargestPosition(PortfolioSnapshot snapshot) {
        return snapshot.positions().stream()
                .max(Comparator.comparing(PositionSnapshot::marketValue))
                .orElse(null);
    }
}
