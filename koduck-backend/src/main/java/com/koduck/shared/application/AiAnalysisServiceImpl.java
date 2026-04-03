package com.koduck.shared.application;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.config.AgentConfig;
import com.koduck.dto.ai.BacktestInterpretResponse;
import com.koduck.dto.ai.ChatStreamRequest;
import com.koduck.dto.ai.RiskAssessmentResponse;
import com.koduck.dto.ai.StockAnalysisRequest;
import com.koduck.dto.ai.StockAnalysisResponse;
import com.koduck.dto.ai.StrategyRecommendRequest;
import com.koduck.dto.ai.StrategyRecommendResponse;
import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.entity.BacktestResult;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Strategy;
import com.koduck.exception.ExternalServiceException;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.BacktestResultRepository;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.service.AiAnalysisService;
import com.koduck.service.UserSettingsService;
import com.koduck.service.support.AiConversationSupport;
import com.koduck.service.support.AiRecommendationSupport;
import com.koduck.service.support.AiStreamRelaySupport;

import lombok.extern.slf4j.Slf4j;

/**
 * AI analysis service implementation - calls koduck-agent.
 *
 * @author GitHub Copilot
 */
@Service
@Slf4j
public class AiAnalysisServiceImpl implements AiAnalysisService {

    /** Pattern for matching stock symbols (6 digits). */
    private static final Pattern SYMBOL_PATTERN = Pattern.compile("\\b\\d{6}\\b");

    /** Default LLM provider. */
    private static final String DEFAULT_LLM_PROVIDER = "minimax";

    /** Key for choices in response. */
    private static final String KEY_CHOICES = "choices";

    /** Key for message in response. */
    private static final String KEY_MESSAGE = "message";

    /** Key for content in response. */
    private static final String KEY_CONTENT = "content";

    /** Risk level: aggressive. */
    private static final String RISK_AGGRESSIVE = "aggressive";

    /** Risk level: conservative. */
    private static final String RISK_CONSERVATIVE = "conservative";

    /** Risk level: balanced. */
    private static final String RISK_BALANCED = "balanced";

    /** Guard message to prevent tool markup in output. */
    private static final String NO_TOOL_MARKUP_GUARD =
        "输出约束: 不要使用或模拟任何工具调用，不要输出 <minimax:tool_call>、<invoke>、<parameter>、"
            + "XML/JSON函数调用片段。请直接输出面向用户的自然语言分析结论。";

    /** Set of supported LLM providers. */
    private static final Set<String> SUPPORTED_LLM_PROVIDERS =
        Set.of(DEFAULT_LLM_PROVIDER, "deepseek", "openai");

    /** Response type for map responses. */
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<>() {
        };

    /** Timeout duration for connection (seconds). */
    private static final int CONNECTION_TIMEOUT_SECONDS = 30;

    /** Timeout duration for read (seconds). */
    private static final int READ_TIMEOUT_SECONDS = 60;

    /** HTTP status code for internal server error. */
    private static final int HTTP_STATUS_INTERNAL_ERROR = 500;

    /** Repository for portfolio positions. */
    private final PortfolioPositionRepository positionRepository;

    /** Repository for strategies. */
    private final StrategyRepository strategyRepository;

    /** Repository for backtest results. */
    private final BacktestResultRepository backtestResultRepository;

    /** Service for user settings. */
    private final UserSettingsService userSettingsService;

    /** Configuration for agent. */
    private final AgentConfig agentConfig;

    /** Object mapper for JSON serialization. */
    private final ObjectMapper objectMapper;

    /** REST template for HTTP calls. */
    private final RestTemplate restTemplate;

    /** Support for AI conversations. */
    private final AiConversationSupport aiConversationSupport;

    /** Support for AI stream relay. */
    private final AiStreamRelaySupport aiStreamRelaySupport;

    /** Support for AI recommendations. */
    private final AiRecommendationSupport aiRecommendationSupport;

    /**
     * Constructs a new AiAnalysisServiceImpl.
     *
     * @param positionRepository the portfolio position repository
     * @param strategyRepository the strategy repository
     * @param backtestResultRepository the backtest result repository
     * @param userSettingsService the user settings service
     * @param agentConfig the agent configuration
     * @param objectMapper the object mapper
     * @param restTemplateBuilder the REST template builder
     * @param aiConversationSupport the AI conversation support
     * @param aiStreamRelaySupport the AI stream relay support
     * @param aiRecommendationSupport the AI recommendation support
     */
    public AiAnalysisServiceImpl(
            PortfolioPositionRepository positionRepository,
            StrategyRepository strategyRepository,
            BacktestResultRepository backtestResultRepository,
            UserSettingsService userSettingsService,
            AgentConfig agentConfig,
            ObjectMapper objectMapper,
            RestTemplateBuilder restTemplateBuilder,
            AiConversationSupport aiConversationSupport,
            AiStreamRelaySupport aiStreamRelaySupport,
            AiRecommendationSupport aiRecommendationSupport) {
        this.positionRepository = positionRepository;
        this.strategyRepository = strategyRepository;
        this.backtestResultRepository = backtestResultRepository;
        this.userSettingsService = userSettingsService;
        this.agentConfig = agentConfig;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplateBuilder
            .connectTimeout(Duration.ofSeconds(CONNECTION_TIMEOUT_SECONDS))
            .readTimeout(Duration.ofSeconds(READ_TIMEOUT_SECONDS))
            .build();
        this.aiConversationSupport = aiConversationSupport;
        this.aiStreamRelaySupport = aiStreamRelaySupport;
        this.aiRecommendationSupport = aiRecommendationSupport;
    }

    @Override
    public StockAnalysisResponse analyzeStock(Long userId, StockAnalysisRequest request) {
        String provider = resolveProvider(request.getProvider());
        LlmConfigDto effectiveConfig =
            userSettingsService.getEffectiveLlmConfig(userId, provider);
        try {
            String userQuestion = buildStockAnalysisPrompt(request);
            String aiResponse = callAgentChat(provider, userQuestion, effectiveConfig);
            return StockAnalysisResponse.builder()
                .analysis(aiResponse)
                .provider(provider)
                .model(provider + "-model")
                .symbol(request.getSymbol())
                .market(request.getMarket())
                .analysisType(request.getAnalysisType() != null ? request.getAnalysisType() : "comprehensive")
                .reasoning(aiResponse)
                .recommendation(aiRecommendationSupport.generateRecommendationFromResponse(aiResponse))
                .generatedAt(LocalDateTime.now())
                .build();
        }
        catch (Exception e) {
            log.error("Failed to call koduck-agent: {}", e.getMessage(), e);
            throw ExternalServiceException.of("koduck-agent", "AI 分析服务调用失败: " + e.getMessage(), e);
        }
    }

    @Override
    public SseEmitter streamChat(Long userId, ChatStreamRequest request) {
        SseEmitter emitter = new SseEmitter(0L);
        String provider = resolveProvider(request.getProvider());
        String sessionId = aiConversationSupport.resolveSessionId(request.getSessionId());
        LlmConfigDto effectiveConfig =
            userSettingsService.getEffectiveLlmConfig(userId, provider);

        ChatStreamRequest configuredRequest = ChatStreamRequest.builder()
            .provider(provider)
            .model(blankToNull(request.getModel()))
            .apiKey(blankToNull(effectiveConfig != null ? effectiveConfig.getApiKey() : null))
            .apiBase(effectiveConfig != null ? effectiveConfig.getApiBase() : null)
            .sessionId(sessionId)
            .role(request.getRole())
            .runtime(request.getRuntime())
            .disableToolCalls(Boolean.TRUE.equals(request.getDisableToolCalls()))
            .messages(request.getMessages())
            .build();

        ChatStreamRequest memoryEnhancedRequest =
            aiConversationSupport.enrichWithMemoryContext(userId, configuredRequest);
        ChatStreamRequest guardedRequest = Boolean.TRUE.equals(request.getDisableToolCalls())
            ? aiConversationSupport.appendInstructionToSystem(memoryEnhancedRequest, NO_TOOL_MARKUP_GUARD)
            : memoryEnhancedRequest;
        ChatStreamRequest enhancedRequest = aiConversationSupport.enrichWithQuantSignalIfNeeded(
            guardedRequest, SYMBOL_PATTERN);

        aiConversationSupport.scheduleUserMemoryWriteBack(
            userId, enhancedRequest, SYMBOL_PATTERN,
            RISK_AGGRESSIVE, RISK_CONSERVATIVE, RISK_BALANCED);

        CompletableFuture.runAsync(() -> relayAgentStream(userId, enhancedRequest, emitter));
        return emitter;
    }

    @Override
    public StrategyRecommendResponse recommendStrategies(Long userId, StrategyRecommendRequest request) {
        log.debug("Recommending strategies for user: {}, risk: {}", userId, request.getRiskPreference());
        List<Strategy> userStrategies = strategyRepository.findByUserId(userId);
        return aiRecommendationSupport.buildStrategyRecommendations(userStrategies, request);
    }

    @Override
    public BacktestInterpretResponse interpretBacktest(Long userId, Long backtestResultId) {
        log.debug("Interpreting backtest: {} for user: {}", backtestResultId, userId);
        BacktestResult result = backtestResultRepository.findByIdAndUserId(backtestResultId, userId)
            .orElseThrow(() -> ResourceNotFoundException.of("Backtest result", backtestResultId));
        return aiRecommendationSupport.buildBacktestInterpretation(backtestResultId, result);
    }

    @Override
    public RiskAssessmentResponse assessRisk(Long userId, Long portfolioId) {
        log.debug("Assessing risk for portfolio: {} of user: {}", portfolioId, userId);
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        return aiRecommendationSupport.buildRiskAssessment(portfolioId, positions);
    }

    private String buildStockAnalysisPrompt(StockAnalysisRequest request) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("请分析股票 ").append(request.getSymbol());
        if (request.getName() != null) {
            prompt.append(" (").append(request.getName()).append(")");
        }
        prompt.append("。\n\n");
        appendIfPresent(prompt, "当前价格", request.getPrice());
        appendIfPresent(prompt, "涨跌幅",
            request.getChangePercent() == null ? null : request.getChangePercent() + "%");
        appendIfPresent(prompt, "开盘价", request.getOpenPrice());
        appendIfPresent(prompt, "最高价", request.getHigh());
        appendIfPresent(prompt, "最低价", request.getLow());
        appendIfPresent(prompt, "昨收价", request.getPrevClose());
        appendIfPresent(prompt, "成交量", request.getVolume());
        prompt.append("\n用户问题: ").append(request.getQuestion());
        return prompt.toString();
    }

    private void appendIfPresent(StringBuilder builder, String key, Object value) {
        if (value != null) {
            builder.append(key).append(": ").append(value).append("\n");
        }
    }

    private String callAgentChat(String provider, String userMessage, LlmConfigDto config) {
        String agentUrl = agentConfig.getUrl() + "/v1/chat/completions";
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("provider", resolveProvider(provider));
        requestBody.put("apiKey", blankToNull(config != null ? config.getApiKey() : null));
        requestBody.put("apiBase", config != null ? config.getApiBase() : null);
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "user", KEY_CONTENT, userMessage));
        requestBody.put("messages", messages);
        requestBody.put("stream", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
            agentUrl,
            Objects.requireNonNull(HttpMethod.POST),
            entity,
            Objects.requireNonNull(MAP_RESPONSE_TYPE)
        );

        String content = extractAgentContent(response.getBody());
        if (content != null) {
            return content;
        }
        throw ExternalServiceException.of("koduck-agent", "Invalid response from agent: empty response");
    }

    private String extractAgentContent(Map<?, ?> body) {
        if (body == null) {
            return null;
        }
        Object choicesObject = body.get(KEY_CHOICES);
        if (!(choicesObject instanceof List<?> choices) || choices.isEmpty()) {
            return null;
        }
        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choiceMap)) {
            return null;
        }
        Object messageObject = choiceMap.get(KEY_MESSAGE);
        if (!(messageObject instanceof Map<?, ?> messageMap)) {
            return null;
        }
        Object contentObject = messageMap.get(KEY_CONTENT);
        if (contentObject instanceof String content) {
            return content;
        }
        return null;
    }

    private void relayAgentStream(Long userId, ChatStreamRequest request, SseEmitter emitter) {
        try {
            String provider = resolveProvider(request.getProvider());
            ChatStreamRequest normalizedRequest = normalizeStreamRequest(request, provider);
            String agentUrl = agentConfig.getUrl() + "/api/v1/ai/chat/stream";

            AiStreamRelaySupport.StreamRelayResult relayResult =
                aiStreamRelaySupport.relayStreamEvents(agentUrl, normalizedRequest, emitter);

            if (relayResult.assistantContent() != null && !relayResult.assistantContent().isBlank()) {
                aiConversationSupport.scheduleAssistantMemoryWriteBack(
                    userId, request, relayResult.assistantContent(), relayResult.tokenCount());
            }
            emitter.complete();
        }
        catch (AiStreamRelaySupport.StreamRelayException e) {
            sendStreamErrorEvent(emitter, e.statusCode(), "AI 服务调用失败: " + e.detail());
        }
        catch (RuntimeException e) {
            sendStreamErrorEvent(emitter, HTTP_STATUS_INTERNAL_ERROR,
                "后端转发 AI 流式响应失败: " + e.getMessage());
        }
    }

    private void sendStreamErrorEvent(SseEmitter emitter, int code, String message) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("code", code);
            payload.put(KEY_MESSAGE, message == null ? "" : message);
            Object serializedPayload = Objects.requireNonNull(
                objectMapper.writeValueAsString(payload),
                "serializedPayload must not be null");
            emitter.send(SseEmitter.event().name("error").data(serializedPayload));
        }
        catch (IOException | RuntimeException sendError) {
            log.warn("Failed to send SSE error event: {}", sendError.getMessage());
        }
        finally {
            emitter.complete();
        }
    }

    private ChatStreamRequest normalizeStreamRequest(ChatStreamRequest request, String provider) {
        return ChatStreamRequest.builder()
            .provider(provider)
            .model(blankToNull(request.getModel()))
            .apiKey(blankToNull(request.getApiKey()))
            .apiBase(request.getApiBase())
            .sessionId(request.getSessionId())
            .role(request.getRole())
            .runtime(request.getRuntime())
            .disableToolCalls(request.getDisableToolCalls())
            .messages(request.getMessages())
            .build();
    }

    private String resolveProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return DEFAULT_LLM_PROVIDER;
        }
        String normalized = provider.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LLM_PROVIDERS.contains(normalized) ? normalized : DEFAULT_LLM_PROVIDER;
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }
}
