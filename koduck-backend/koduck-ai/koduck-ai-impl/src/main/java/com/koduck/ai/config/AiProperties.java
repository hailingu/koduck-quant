package com.koduck.ai.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * AI 模块配置属性。
 *
 * <p>配置前缀: {@code koduck.ai}</p>
 *
 * <p>示例配置:</p>
 * <pre>
 * koduck:
 *   ai:
 *     llm:
 *       default-provider: openai
 *       timeout: 30000
 * </pre>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Data
@Validated
@ConfigurationProperties(prefix = "koduck.ai")
public class AiProperties {

    /** LLM 配置。 */
    private LlmConfig llm = new LlmConfig();

    /** 分析配置。 */
    private AnalysisConfig analysis = new AnalysisConfig();

    /** 风险阈值配置。 */
    private RiskConfig risk = new RiskConfig();

    /**
     * LLM 配置。
     */
    @Data
    public static class LlmConfig {
        /** 默认提供商。 */
        @NotNull
        @Pattern(regexp = "openai|anthropic|local", message = "LLM 提供商必须是 openai、anthropic 或 local")
        private String defaultProvider = "openai";

        /** 请求超时（毫秒）。 */
        @Min(1000)
        @Max(60000)
        private int timeout = 30000;

        /** 最大重试次数。 */
        @Min(1)
        @Max(5)
        private int maxRetries = 3;

        /** 温度参数（创造性 vs 确定性）。 */
        @Min(0)
        @Max(2)
        private double temperature = 0.7;

        /** 最大 token 数。 */
        @Min(100)
        @Max(8000)
        private int maxTokens = 2000;
    }

    /**
     * 分析配置。
     */
    @Data
    public static class AnalysisConfig {
        /** 启用自动分析。 */
        private boolean enabled = true;
        /** 新组合自动分析。 */
        private boolean autoAnalyzeNewPortfolio = true;
        /** 信号自动分析。 */
        private boolean autoAnalyzeSignal = true;
        /** 分析线程池大小。 */
        @Min(1)
        @Max(10)
        private int threadPoolSize = 4;
    }

    /**
     * 风险阈值配置。
     */
    @Data
    public static class RiskConfig {
        /** 高集中度阈值（持仓占比）。 */
        private double highConcentrationThreshold = 0.30;
        /** 中等集中度阈值。 */
        private double mediumConcentrationThreshold = 0.20;
        /** 高波动率阈值。 */
        private double highVolatilityThreshold = 0.25;
        /** 中等波动率阈值。 */
        private double mediumVolatilityThreshold = 0.15;
    }
}
