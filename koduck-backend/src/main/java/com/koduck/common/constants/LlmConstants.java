package com.koduck.common.constants;

/**
 * LLM provider and configuration constants.
 *
 * @author Koduck Team
 */
public final class LlmConstants {

    /** Minimax provider identifier. */
    public static final String PROVIDER_MINIMAX = "minimax";

    /** DeepSeek provider identifier. */
    public static final String PROVIDER_DEEPSEEK = "deepseek";

    /** OpenAI provider identifier. */
    public static final String PROVIDER_OPENAI = "openai";

    /** Environment variable name for LLM API base URL. */
    public static final String ENV_LLM_API_BASE = "LLM_API_BASE";

    /** Environment variable name for LLM API key. */
    public static final String ENV_LLM_API_KEY = "LLM_API_KEY";

    private LlmConstants() {
    }
}
