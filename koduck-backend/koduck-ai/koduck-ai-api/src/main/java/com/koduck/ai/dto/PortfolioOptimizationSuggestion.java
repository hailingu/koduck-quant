package com.koduck.ai.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 投资组合优化建议。
 *
 * @param type 建议类型
 * @param priority 优先级 (1-5, 5 为最高)
 * @param title 建议标题
 * @param description 建议详细描述
 * @param expectedImpact 预期影响
 * @param relatedSymbol 相关股票代码（如有）
 */
@Value
@Builder
public class PortfolioOptimizationSuggestion {
    SuggestionType type;
    Integer priority;
    String title;
    String description;
    String expectedImpact;
    String relatedSymbol;

    public enum SuggestionType {
        // 分散化建议
        DIVERSIFICATION,
        // 再平衡建议
        REBALANCING,
        // 风险降低建议
        RISK_REDUCTION,
        // 机会捕捉建议
        OPPORTUNITY,
        // 成本优化建议
        COST_OPTIMIZATION
    }
}
