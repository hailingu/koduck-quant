package com.koduck.service;

import com.koduck.ai.dto.PortfolioRiskAssessment;
import com.koduck.ai.dto.PortfolioOptimizationSuggestion;
import com.koduck.portfolio.dto.PortfolioSnapshot;

import java.util.List;
import java.util.Optional;

/**
 * AI 分析服务接口 - 提供基于 AI 的投资组合分析功能。
 *
 * <p>本服务通过 Portfolio ACL 接口访问投资组合数据，遵循分层架构设计原则，
 * 不直接依赖 Portfolio 模块的内部实现。</p>
 *
 * @author Koduck AI Team
 * @since 0.1.0
 */
public interface AiAnalysisService {

    /**
     * 对指定投资组合进行风险评估。
     *
     * @param portfolioId 投资组合 ID
     * @return 风险评估结果，如果投资组合不存在则返回 empty
     */
    Optional<PortfolioRiskAssessment> assessPortfolioRisk(Long portfolioId);

    /**
     * 对指定投资组合进行收益分析。
     *
     * @param portfolioId 投资组合 ID
     * @return 收益分析文本，如果投资组合不存在则返回 empty
     */
    Optional<String> analyzePortfolioReturns(Long portfolioId);

    /**
     * 获取投资组合优化建议。
     *
     * @param portfolioId 投资组合 ID
     * @return 优化建议列表，如果投资组合不存在则返回 empty
     */
    Optional<List<PortfolioOptimizationSuggestion>> suggestOptimizations(Long portfolioId);

    /**
     * 分析投资组合集中度风险。
     *
     * @param snapshot 投资组合快照
     * @return 集中度风险评分 (0-100)，分数越高风险越大
     */
    double calculateConcentrationRisk(PortfolioSnapshot snapshot);

    /**
     * 分析投资组合行业分布。
     *
     * @param snapshot 投资组合快照
     * @return 行业分布分析文本
     */
    String analyzeSectorDistribution(PortfolioSnapshot snapshot);
}
