package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * LLM 配置 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LlmConfigDto {

    /** 提供商. */
    private String provider;

    /** API Key. */
    private String apiKey;

    /** API Base. */
    private String apiBase;

    /** Minimax 配置. */
    private ProviderConfigDto minimax;

    /** Deepseek 配置. */
    private ProviderConfigDto deepseek;

    /** OpenAI 配置. */
    private ProviderConfigDto openai;

    /** 记忆配置. */
    private MemoryConfigDto memory;
}
