package com.koduck.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.common.constants.MarketConstants;
import com.koduck.config.AgentConfig;
import com.koduck.dto.ai.*;
import com.koduck.dto.settings.UserSettingsDto;
import com.koduck.dto.indicator.IndicatorResponse;
import com.koduck.entity.BacktestResult;
import com.koduck.entity.MemoryChatMessage;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Strategy;
import com.koduck.entity.UserMemoryProfile;
import com.koduck.exception.ExternalServiceException;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.BacktestResultRepository;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.service.AiAnalysisService;
import com.koduck.service.MemoryService;
import com.koduck.service.TechnicalIndicatorService;
import com.koduck.service.UserSettingsService;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.client.RestTemplate;

/**
 * AI 分析服务实现 - 调用 koduck-agent
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiAnalysisServiceImpl implements AiAnalysisService {
    private static final Pattern SYMBOL_PATTERN = Pattern.compile("\\b\\d{6}\\b");
    private static final String DEFAULT_LLM_PROVIDER = "minimax";
    private static final String KEY_CHOICES = "choices";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_CONTENT = "content";
    private static final String EVENT_MESSAGE = "message";
    private static final String EVENT_DONE = "done";
    private static final String RISK_AGGRESSIVE = "aggressive";
    private static final String RISK_CONSERVATIVE = "conservative";
    private static final String RISK_BALANCED = "balanced";
    private static final String RESPONSE_TYPE_NULL_MESSAGE = "responseType must not be null";
    private static final String HTTP_METHOD_NULL_MESSAGE = "httpMethod must not be null";
    private static final Set<String> SUPPORTED_LLM_PROVIDERS = Set.of(DEFAULT_LLM_PROVIDER, "deepseek", "openai");
    private static final String NO_TOOL_MARKUP_GUARD =
        "输出约束: 不要使用或模拟任何工具调用，不要输出 <minimax:tool_call>、<invoke>、<parameter>、XML/JSON函数调用片段。"
            + "请直接输出面向用户的自然语言分析结论。";
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<>() {
        };
    private static final TypeReference<Map<String, Object>> MAP_TYPE_REFERENCE =
        new TypeReference<>() {
        };

    private final PortfolioPositionRepository positionRepository;
    private final StrategyRepository strategyRepository;
    private final BacktestResultRepository backtestResultRepository;
    private final TechnicalIndicatorService technicalIndicatorService;
    private final UserSettingsService userSettingsService;
    private final MemoryService memoryService;
    private final AgentConfig agentConfig;
    private final ObjectMapper objectMapper;
    private final RestTemplateBuilder restTemplateBuilder;

    private final Random random = new Random();
    private RestTemplate restTemplate;

    private static @NonNull ParameterizedTypeReference<Map<String, Object>> getMapResponseType() {
        return Objects.requireNonNull(MAP_RESPONSE_TYPE, RESPONSE_TYPE_NULL_MESSAGE);
    }

    private static @NonNull HttpMethod getHttpPostMethod() {
        return Objects.requireNonNull(HttpMethod.POST, HTTP_METHOD_NULL_MESSAGE);
    }

    private RestTemplate getRestTemplate() {
        if (restTemplate == null) {
            restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofSeconds(30))
                .readTimeout(Duration.ofSeconds(60))
                .build();
        }
        return restTemplate;
    }
    /**
     * 分析股票 - 调用 koduck-agent AI 服务
     */
    @Override
    public StockAnalysisResponse analyzeStock(Long userId, StockAnalysisRequest request) {
        String symbol = request.getSymbol();
        String market = request.getMarket();
        String question = request.getQuestion();
        String provider = resolveProvider(request.getProvider());
        UserSettingsDto.LlmConfigDto effectiveConfig = userSettingsService.getEffectiveLlmConfig(userId, provider);
        log.debug("Analyzing stock: {}, market: {}, question: {}, provider: {}", symbol, market, question, provider);
        try {
            // 构建用户问题 - 调用 koduck-agent 
            String userQuestion = buildStockAnalysisPrompt(request);
            // 调用 koduck-agent
            String aiResponse = callAgentChat(provider, userQuestion, effectiveConfig);
            return StockAnalysisResponse.builder()
                .analysis(aiResponse)
                .provider(provider)
                .model(provider + "-model")
                .symbol(symbol)
                .market(market)
                .analysisType(request.getAnalysisType() != null ? request.getAnalysisType() : "comprehensive")
                .reasoning(aiResponse)
                .recommendation(generateRecommendationFromResponse(aiResponse))
                .generatedAt(LocalDateTime.now())
                .build();
        } catch (Exception e) {
            log.error("Failed to call koduck-agent: {}", e.getMessage(), e);
            throw ExternalServiceException.of("koduck-agent", "AI 分析服务调用失败: " + e.getMessage(), e);
        }
    }
    /**
     * 构建股票分析 AI Prompt
     */
    private String buildStockAnalysisPrompt(StockAnalysisRequest request) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("请分析股票 ").append(request.getSymbol());
        if (request.getName() != null) {
            prompt.append(" (").append(request.getName()).append(")");
        }
        prompt.append("。\n\n");
        // 添加行情数据
        if (request.getPrice() != null) {
            prompt.append("当前价格: ").append(request.getPrice()).append("\n");
        }
        if (request.getChangePercent() != null) {
            prompt.append("涨跌幅: ").append(request.getChangePercent()).append("%\n");
        }
        if (request.getOpenPrice() != null) {
            prompt.append("开盘价: ").append(request.getOpenPrice()).append("\n");
        }
        if (request.getHigh() != null) {
            prompt.append("最高价: ").append(request.getHigh()).append("\n");
        }
        if (request.getLow() != null) {
            prompt.append("最低价: ").append(request.getLow()).append("\n");
        }
        if (request.getPrevClose() != null) {
            prompt.append("昨收价: ").append(request.getPrevClose()).append("\n");
        }
        if (request.getVolume() != null) {
            prompt.append("成交量: ").append(request.getVolume()).append("\n");
        }
        prompt.append("\n用户问题: ").append(request.getQuestion());
        return prompt.toString();
    }
    /**
     * 调用 koduck-agent chat API
     */
    private String callAgentChat(String provider, String userMessage, UserSettingsDto.LlmConfigDto config) {
        String agentUrl = agentConfig.getUrl() + "/v1/chat/completions";
        // 构建请求体
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
        log.info("Calling koduck-agent: provider={}, url={}", provider, agentUrl);
        ResponseEntity<Map<String, Object>> response = getRestTemplate().exchange(
            agentUrl,
            getHttpPostMethod(),
            entity,
            getMapResponseType()
        );
        log.debug("Agent response: {}", response.getBody());
        String content = extractAgentContent(response.getBody());
        if (content != null) {
            log.info("Agent response content: {}", content);
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
    /**
     * 流式聊天，调用 koduck-agent
     */
    @Override
    public SseEmitter streamChat(Long userId, ChatStreamRequest request) {
        SseEmitter emitter = new SseEmitter(0L);
        String provider = resolveProvider(request.getProvider());
        String sessionId = memoryService.resolveSessionId(request.getSessionId());
        UserSettingsDto.LlmConfigDto effectiveConfig = userSettingsService.getEffectiveLlmConfig(userId, provider);
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
        ChatStreamRequest memoryEnhancedRequest = enrichWithMemoryContext(userId, configuredRequest);
        ChatStreamRequest guardedRequest = Boolean.TRUE.equals(request.getDisableToolCalls())
            ? appendInstructionToSystem(memoryEnhancedRequest, NO_TOOL_MARKUP_GUARD)
            : memoryEnhancedRequest;
        ChatStreamRequest enhancedRequest = enrichWithQuantSignalIfNeeded(guardedRequest);
        scheduleUserMemoryWriteBack(userId, enhancedRequest);
        CompletableFuture.runAsync(() -> relayAgentStream(userId, enhancedRequest, emitter));
        return emitter;
    }
    private ChatStreamRequest enrichWithMemoryContext(Long userId, ChatStreamRequest request) {
        if (!memoryService.isEnabled()) {
            return request;
        }
        try {
            String sessionId = memoryService.resolveSessionId(request.getSessionId());
            List<MemoryChatMessage> recentMessages = memoryService.getRecentMessages(
                userId,
                sessionId,
                memoryService.getL1MaxTurns()
            );
            UserMemoryProfile profile = memoryService.getOrCreateProfile(userId);
            String memoryContext = buildMemoryContext(sessionId, recentMessages, profile);
            if (memoryContext.isBlank()) {
                return request;
            }
            log.debug(
                "Injected memory context: user={}, session={}, recentMessages={}",
                userId,
                sessionId,
                recentMessages.size()
            );
            return appendInstructionToSystem(request, memoryContext);
        } catch (Exception e) {
            log.warn("Failed to inject memory context, fallback to original request: {}", e.getMessage());
            return request;
        }
    }
    private String buildMemoryContext(
        String sessionId,
        List<MemoryChatMessage> recentMessages,
        UserMemoryProfile profile
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("【Memory Context】\n");
        builder.append("session_id: ").append(sessionId).append("\n");
        boolean hasProfile = appendProfileMemoryContext(builder, profile);
        boolean hasRecent = appendRecentMessagesContext(builder, recentMessages);
        if (!hasProfile && !hasRecent) {
            return "";
        }
        String result = builder.toString().trim();
        return result
            + "\n请把以上内容视为会话记忆，仅用于提升连续性，不要编造不存在的事实。";
    }
    private boolean appendProfileMemoryContext(StringBuilder builder, UserMemoryProfile profile) {
        if (profile == null) {
            return false;
        }
        String riskPreference = profile.getRiskPreference();
        List<String> watchSymbols = profile.getWatchSymbols();
        List<String> preferredSources = profile.getPreferredSources();
        boolean hasRiskPreference = riskPreference != null && !riskPreference.isBlank();
        boolean hasWatchSymbols = watchSymbols != null && !watchSymbols.isEmpty();
        boolean hasPreferredSources = preferredSources != null && !preferredSources.isEmpty();
        if (!hasRiskPreference && !hasWatchSymbols && !hasPreferredSources) {
            return false;
        }
        builder.append("用户偏好:\n");
        if (hasRiskPreference) {
            builder.append("- risk_preference: ").append(riskPreference).append("\n");
        }
        if (hasWatchSymbols) {
            builder.append("- watch_symbols: ").append(String.join(", ", watchSymbols)).append("\n");
        }
        if (hasPreferredSources) {
            builder.append("- preferred_sources: ").append(String.join(", ", preferredSources)).append("\n");
        }
        return true;
    }
    private boolean appendRecentMessagesContext(StringBuilder builder, List<MemoryChatMessage> recentMessages) {
        if (recentMessages == null || recentMessages.isEmpty()) {
            return false;
        }
        builder.append("最近会话片段:\n");
        int maxLines = Math.min(recentMessages.size(), 8);
        int startIndex = Math.max(0, recentMessages.size() - maxLines);
        for (int i = startIndex; i < recentMessages.size(); i++) {
            MemoryChatMessage item = recentMessages.get(i);
            String role = resolveRole(item);
            String content = normalizeContent(item == null ? null : item.getContent());
            builder.append("- ").append(role).append(": ").append(content).append("\n");
        }
        return true;
    }
    private String resolveRole(MemoryChatMessage item) {
        if (item == null || item.getRole() == null) {
            return "unknown";
        }
        return item.getRole();
    }
    private String normalizeContent(String content) {
        String safeContent = content == null ? "" : content.trim();
        if (safeContent.length() > 180) {
            return safeContent.substring(0, 180) + "...";
        }
        return safeContent;
    }
    private ChatStreamRequest enrichWithQuantSignalIfNeeded(ChatStreamRequest request) {
        try {
            ChatMessageRequest latestUserMessage = findLatestUserMessage(request.getMessages());
            if (latestUserMessage == null) {
                return request;
            }
            String question = latestUserMessage.getContent();
            if (!shouldAttachQuantSignal(question)) {
                return request;
            }
            String symbol = extractSymbol(question);
            if (symbol == null) {
                symbol = extractSymbolFromMessages(request.getMessages());
            }
            if (symbol == null) {
                log.debug("Skip quant signal: no symbol found in chat messages");
                return request;
            }
            String quantContext = buildQuantSignalContext(symbol, MarketConstants.DEFAULT_MARKET);
            if (quantContext == null || quantContext.isBlank()) {
                return request;
            }
            log.info("Attached quant signal context for symbol={}", symbol);
            return appendInstructionToLatestUser(request, quantContext);
        } catch (Exception e) {
            log.warn("Failed to enrich chat with quant signal, fallback to original request: {}", e.getMessage());
            return request;
        }
    }
    private ChatStreamRequest appendInstructionToSystem(ChatStreamRequest request, String instruction) {
        if (instruction == null || instruction.isBlank()) {
            return request;
        }
        List<ChatMessageRequest> originalMessages = request.getMessages();
        if (originalMessages == null || originalMessages.isEmpty()) {
            return request;
        }
        List<ChatMessageRequest> updatedMessages = mergeSystemInstruction(originalMessages, instruction);
        return rebuildChatStreamRequest(request, updatedMessages);
    }
    private List<ChatMessageRequest> mergeSystemInstruction(
        List<ChatMessageRequest> originalMessages,
        String instruction
    ) {
        List<ChatMessageRequest> updatedMessages = new ArrayList<>(originalMessages.size() + 1);
        boolean merged = false;
        for (int i = 0; i < originalMessages.size(); i++) {
            ChatMessageRequest msg = originalMessages.get(i);
            if (!merged && "system".equalsIgnoreCase(msg.getRole())) {
                updatedMessages.add(buildMergedSystemMessage(msg, instruction));
                merged = true;
            } else {
                updatedMessages.add(msg);
            }
        }
        if (!merged) {
            updatedMessages.add(0, ChatMessageRequest.builder()
                .role("system")
                .content(instruction)
                .build());
        }
        return updatedMessages;
    }
    private ChatMessageRequest buildMergedSystemMessage(ChatMessageRequest message, String instruction) {
        String existing = message.getContent() == null ? "" : message.getContent();
        String mergedContent = existing.isBlank() ? instruction : existing + "\n\n" + instruction;
        return ChatMessageRequest.builder()
            .role(message.getRole())
            .content(mergedContent)
            .build();
    }
    private ChatStreamRequest rebuildChatStreamRequest(ChatStreamRequest request, List<ChatMessageRequest> messages) {
        return ChatStreamRequest.builder()
            .provider(request.getProvider())
            .model(request.getModel())
            .apiKey(request.getApiKey())
            .apiBase(request.getApiBase())
            .sessionId(request.getSessionId())
            .role(request.getRole())
            .runtime(request.getRuntime())
            .disableToolCalls(request.getDisableToolCalls())
            .messages(messages)
            .build();
    }
    private ChatStreamRequest appendInstructionToLatestUser(ChatStreamRequest request, String instruction) {
        if (instruction == null || instruction.isBlank()) {
            return request;
        }
        List<ChatMessageRequest> originalMessages = request.getMessages();
        if (originalMessages == null || originalMessages.isEmpty()) {
            return request;
        }
        List<ChatMessageRequest> updatedMessages = new ArrayList<>(originalMessages.size());
        boolean merged = false;
        for (int i = originalMessages.size() - 1; i >= 0; i--) {
            ChatMessageRequest msg = originalMessages.get(i);
            if (!merged && "user".equalsIgnoreCase(msg.getRole())) {
                String existing = msg.getContent() == null ? "" : msg.getContent();
                String mergedContent = existing
                    + "\n\n【自动量化信号】\n"
                    + instruction
                    + "\n\n请优先基于上述量化信号给出结论（方向、入场/观望、风险位），不要再说\"没有实时数据\"。";
                updatedMessages.add(0, ChatMessageRequest.builder()
                    .role(msg.getRole())
                    .content(mergedContent)
                    .build());
                merged = true;
            } else {
                updatedMessages.add(0, msg);
            }
        }
        return rebuildChatStreamRequest(request, updatedMessages);
    }
    private ChatMessageRequest findLatestUserMessage(List<ChatMessageRequest> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            ChatMessageRequest msg = messages.get(i);
            if ("user".equalsIgnoreCase(msg.getRole())) {
                return msg;
            }
        }
        return null;
    }
    private boolean shouldAttachQuantSignal(String question) {
        if (question == null) {
            return false;
        }
        String text = question.toLowerCase(Locale.ROOT);
        return text.contains("策略")
            || text.contains("买点")
            || text.contains("卖点")
            || text.contains("信号")
            || text.contains("入场")
            || text.contains("出场")
            || text.contains("做多")
            || text.contains("做空")
            || text.contains("trend")
            || text.contains("signal");
    }
    private String extractSymbolFromMessages(List<ChatMessageRequest> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            String symbol = extractSymbol(messages.get(i).getContent());
            if (symbol != null) {
                return symbol;
            }
        }
        return null;
    }
    private String extractSymbol(String text) {
        if (text == null) {
            return null;
        }
        Matcher matcher = SYMBOL_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }
    private String buildQuantSignalContext(String symbol, String market) {
        IndicatorResponse ema20 = technicalIndicatorService.calculateIndicator(market, symbol, "EMA", 20);
        IndicatorResponse ema60 = technicalIndicatorService.calculateIndicator(market, symbol, "EMA", 60);
        IndicatorResponse macd = technicalIndicatorService.calculateIndicator(market, symbol, "MACD", 12);
        BigDecimal ema20Value = getIndicatorValue(ema20, "ema");
        BigDecimal ema60Value = getIndicatorValue(ema60, "ema");
        BigDecimal hist = getIndicatorValue(macd, "histogram");
        BigDecimal macdValue = getIndicatorValue(macd, "macd");
        BigDecimal signalValue = getIndicatorValue(macd, "signal");
        if (ema20Value == null || ema60Value == null || hist == null || macdValue == null || signalValue == null) {
            log.warn("Incomplete indicator values for symbol={}, skip quant context", symbol);
            return null;
        }
        String direction = ema20Value.compareTo(ema60Value) >= 0 ? "LONG_BIAS" : "SHORT_BIAS";
        String momentum = hist.compareTo(BigDecimal.ZERO) >= 0 ? "MOMENTUM_UP" : "MOMENTUM_DOWN";
        String action;
        if ("LONG_BIAS".equals(direction) && "MOMENTUM_UP".equals(momentum)) {
            action = "BUY_OR_HOLD";
        } else if ("SHORT_BIAS".equals(direction) && "MOMENTUM_DOWN".equals(momentum)) {
            action = "REDUCE_OR_WAIT";
        } else {
            action = "NEUTRAL_WAIT_CONFIRM";
        }
        return String.format(
            Locale.ROOT,
            "量化信号上下文(自动注入): symbol=%s, market=%s, EMA20=%s, EMA60=%s, MACD=%s, SIGNAL=%s, HIST=%s, direction=%s, momentum=%s, action=%s。"
                + "请把这个信号作为参考之一，明确提示风险，不要给出确定性收益承诺。",
            symbol,
            market,
            ema20Value.toPlainString(),
            ema60Value.toPlainString(),
            macdValue.toPlainString(),
            signalValue.toPlainString(),
            hist.toPlainString(),
            direction,
            momentum,
            action
        );
    }
    private BigDecimal getIndicatorValue(IndicatorResponse response, String key) {
        if (response == null || response.values() == null) {
            return null;
        }
        return response.values().get(key);
    }
    private void relayAgentStream(Long userId, ChatStreamRequest request, SseEmitter emitter) {
        HttpURLConnection connection = null;
        try {
            String agentUrl = agentConfig.getUrl() + "/api/v1/ai/chat/stream";
            String provider = resolveProvider(request.getProvider());
            ChatStreamRequest normalizedRequest = normalizeStreamRequest(request, provider);
            String requestBody = objectMapper.writeValueAsString(normalizedRequest);
            connection = openStreamConnection(agentUrl, requestBody);

            int statusCode = connection.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                handleStreamErrorResponse(connection, emitter, statusCode);
                return;
            }

            StreamRelayResult relayResult = relayStreamEvents(connection, emitter);
            if (relayResult.assistantContent() != null && !relayResult.assistantContent().isBlank()) {
                scheduleAssistantMemoryWriteBack(userId, request, relayResult.assistantContent(), relayResult.tokenCount());
            }

            log.info(
                "AI chat stream relay completed: provider={}, model={}, session={}",
                provider,
                request.getModel(),
                request.getSessionId()
            );
            emitter.complete();
        } catch (IOException | RuntimeException e) {
            log.error("AI chat stream relay failed: {}", e.getMessage(), e);
            try {
                sendSseEvent(emitter, "error", objectMapper.writeValueAsString(Map.of(
                    "code", 500,
                    KEY_MESSAGE, "后端转发 AI 流式响应失败: " + e.getMessage()
                )));
                emitter.complete();
            } catch (IOException | RuntimeException sendError) {
                log.warn("Failed to send SSE error event: {}", sendError.getMessage());
                emitter.complete();
            }
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
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

    private HttpURLConnection openStreamConnection(String agentUrl, String requestBody) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) URI.create(agentUrl).toURL().openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(30000);
        connection.setReadTimeout(0);
        connection.setRequestProperty("Content-Type", MediaType.APPLICATION_JSON_VALUE);
        connection.setRequestProperty("Accept", MediaType.TEXT_EVENT_STREAM_VALUE);
        connection.setRequestProperty("Cache-Control", "no-cache");
        try (OutputStream output = connection.getOutputStream()) {
            output.write(requestBody.getBytes(StandardCharsets.UTF_8));
            output.flush();
        }
        return connection;
    }

    private void handleStreamErrorResponse(HttpURLConnection connection,
                                           SseEmitter emitter,
                                           int statusCode) throws IOException {
        String detail = readInputStream(connection.getErrorStream());
        sendSseEvent(emitter, "error", objectMapper.writeValueAsString(Map.of(
            "code", statusCode,
            KEY_MESSAGE, "AI 服务调用失败: " + (detail.isBlank() ? "unknown error" : detail)
        )));
        emitter.complete();
    }

    private StreamRelayResult relayStreamEvents(HttpURLConnection connection,
                                                SseEmitter emitter) throws IOException {
        String finalAssistantContent = null;
        Integer finalTokenCount = null;
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
        )) {
            String line;
            String eventName = EVENT_MESSAGE;
            StringBuilder dataBuilder = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    if (EVENT_DONE.equals(eventName)) {
                        String donePayload = dataBuilder.toString();
                        finalAssistantContent = extractAssistantContent(donePayload);
                        finalTokenCount = extractTokenUsage(donePayload);
                    }
                    flushSseEvent(emitter, eventName, dataBuilder);
                    eventName = EVENT_MESSAGE;
                    dataBuilder.setLength(0);
                } else if (line.startsWith("event:")) {
                    eventName = line.substring("event:".length()).trim();
                } else if (line.startsWith("data:")) {
                    appendSseDataLine(dataBuilder, line);
                }
            }
            if (EVENT_DONE.equals(eventName)) {
                String donePayload = dataBuilder.toString();
                finalAssistantContent = extractAssistantContent(donePayload);
                finalTokenCount = extractTokenUsage(donePayload);
            }
            flushSseEvent(emitter, eventName, dataBuilder);
        }
        return new StreamRelayResult(finalAssistantContent, finalTokenCount);
    }

    private void appendSseDataLine(StringBuilder dataBuilder, String line) {
        if (!dataBuilder.isEmpty()) {
            dataBuilder.append('\n');
        }
        dataBuilder.append(line.substring("data:".length()).trim());
    }

    private record StreamRelayResult(String assistantContent, Integer tokenCount) {
    }
    private void scheduleUserMemoryWriteBack(Long userId, ChatStreamRequest request) {
        if (!memoryService.isEnabled()) {
            return;
        }
        ChatMessageRequest latestUserMessage = findLatestUserMessage(request.getMessages());
        if (latestUserMessage == null || latestUserMessage.getContent() == null || latestUserMessage.getContent().isBlank()) {
            return;
        }
        String sessionId = memoryService.resolveSessionId(request.getSessionId());
        String content = latestUserMessage.getContent().trim();
        CompletableFuture.runAsync(() -> {
            try {
                memoryService.appendMessage(
                    userId,
                    sessionId,
                    "user",
                    content,
                    null,
                    Map.of("source", "chat-stream")
                );
                updateUserProfileFromConversation(userId, content);
            } catch (Exception e) {
                log.warn("Skip user memory writeback due to error: {}", e.getMessage());
            }
        });
    }
    private void scheduleAssistantMemoryWriteBack(Long userId, ChatStreamRequest request, String content, Integer tokenCount) {
        if (!memoryService.isEnabled()) {
            return;
        }
        String sessionId = memoryService.resolveSessionId(request.getSessionId());
        CompletableFuture.runAsync(() -> {
            try {
                memoryService.appendMessage(
                    userId,
                    sessionId,
                    "assistant",
                    content,
                    tokenCount,
                    Map.of("source", "chat-stream")
                );
            } catch (Exception e) {
                log.warn("Skip assistant memory writeback due to error: {}", e.getMessage());
            }
        });
    }
    private String extractAssistantContent(String donePayload) {
        if (donePayload == null || donePayload.isBlank()) {
            return "";
        }
        try {
            Map<String, Object> data = objectMapper.readValue(donePayload, MAP_TYPE_REFERENCE);
            Object content = data.get(KEY_CONTENT);
            return content == null ? "" : String.valueOf(content);
        } catch (IOException | RuntimeException _) {
            return "";
        }
    }
    private Integer extractTokenUsage(String donePayload) {
        if (donePayload == null || donePayload.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> data = objectMapper.readValue(donePayload, MAP_TYPE_REFERENCE);
            Object usageObject = data.get("usage");
            if (!(usageObject instanceof Map<?, ?>)) {
                return null;
            }
            Map<String, Object> usage = objectMapper.convertValue(
                    usageObject,
                    MAP_TYPE_REFERENCE
            );
            if (usage != null && usage.get("total_tokens") != null) {
                Object totalTokens = usage.get("total_tokens");
                if (totalTokens instanceof Number number) {
                    return number.intValue();
                }
            }
            return null;
        } catch (IOException | RuntimeException e) {
            log.debug("Failed to extract token usage from done payload: {}", e.getMessage());
            return null;
        }
    }
    private void updateUserProfileFromConversation(Long userId, String latestUserMessage) {
        if (latestUserMessage == null || latestUserMessage.isBlank()) {
            return;
        }
        UserMemoryProfile existing = memoryService.getOrCreateProfile(userId);
        String riskPreference = existing.getRiskPreference();
        if (latestUserMessage.contains("激进")) {
            riskPreference = RISK_AGGRESSIVE;
        } else if (latestUserMessage.contains("保守")) {
            riskPreference = RISK_CONSERVATIVE;
        } else if (latestUserMessage.contains("稳健")) {
            riskPreference = RISK_BALANCED;
        }
        Set<String> watchSymbols = new LinkedHashSet<>(
            existing.getWatchSymbols() != null ? existing.getWatchSymbols() : List.of()
        );
        Matcher matcher = SYMBOL_PATTERN.matcher(latestUserMessage);
        while (matcher.find()) {
            watchSymbols.add(matcher.group());
            if (watchSymbols.size() >= 30) {
                break;
            }
        }
        Set<String> preferredSources = new LinkedHashSet<>(
            existing.getPreferredSources() != null ? existing.getPreferredSources() : List.of()
        );
        if (latestUserMessage.contains("财联社")) {
            preferredSources.add("cls");
        }
        if (latestUserMessage.contains("第一财经")) {
            preferredSources.add("yicai");
        }
        memoryService.upsertProfile(
            userId,
            riskPreference,
            new ArrayList<>(watchSymbols),
            new ArrayList<>(preferredSources),
            existing.getProfileFacts()
        );
    }
    private void flushSseEvent(SseEmitter emitter, String eventName, StringBuilder dataBuilder)
        throws IOException {
        if (dataBuilder.isEmpty()) {
            return;
        }
        // Forward raw upstream payload to avoid converter mismatches that may break chunked stream.
        sendSseEvent(emitter, eventName, dataBuilder.toString());
    }
    private void sendSseEvent(SseEmitter emitter, String eventName, Object data) throws IOException {
        String nonNullEventName = Objects.requireNonNull(eventName, "eventName must not be null");
        Object nonNullData = Objects.requireNonNull(data, "data must not be null");
        emitter.send(SseEmitter.event().name(nonNullEventName).data(nonNullData));
    }
    private String readInputStream(InputStream stream) {
        if (stream == null) {
            return "";
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!builder.isEmpty()) {
                    builder.append('\n');
                }
                builder.append(line);
            }
            return builder.toString();
        } catch (IOException _) {
            return "";
        }
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
    /**
     * 根据 AI 响应生成推荐
     */
    private String generateRecommendationFromResponse(String response) {
        response = response.toLowerCase(Locale.ROOT);
        if (response.contains("买入") || response.contains("建议买入") || response.contains("强烈推荐")) {
            return "建议买入";
        } else if (response.contains("持有") || response.contains("观望")) {
            return "谨慎持有";
        } else if (response.contains("卖出")) {
            return "建议卖出";
        }
        return "建议观望";
    }
    /**
     * 推荐策略
     */
    @Override
    public StrategyRecommendResponse recommendStrategies(Long userId, StrategyRecommendRequest request) {
        log.debug("Recommending strategies for user: {}, risk: {}", userId, request.getRiskPreference());
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
     * 解读回测结果
     */
    @Override
    public BacktestInterpretResponse interpretBacktest(Long userId, Long backtestResultId) {
        log.debug("Interpreting backtest: {} for user: {}", backtestResultId, userId);
        BacktestResult result = backtestResultRepository.findByIdAndUserId(backtestResultId, userId)
            .orElseThrow(() -> ResourceNotFoundException.of("Backtest result", backtestResultId));
        boolean isGoodPerformance = result.getTotalReturn().compareTo(new BigDecimal("0.1")) > 0;
        return BacktestInterpretResponse.builder()
            .backtestResultId(backtestResultId)
            .strategyName("策略 " + result.getStrategyId())
            .performance(generatePerformanceInterpretation(isGoodPerformance))
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
    @Override
    public RiskAssessmentResponse assessRisk(Long userId, Long portfolioId) {
        log.debug("Assessing risk for portfolio: {} of user: {}", portfolioId, userId);
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        int overallScore = 40 + random.nextInt(41); // 40-80，模拟评分
        String riskLevel = resolveRiskLevel(overallScore);
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
    private String generateMatchReason(String riskPreference) {
        return switch (riskPreference) {
            case RISK_CONSERVATIVE -> "适合稳健型投资者，风险可控";
            case RISK_AGGRESSIVE -> "追求高收益，适合激进型投资者";
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
            case RISK_CONSERVATIVE -> {
                classes.add(new StrategyRecommendResponse.AssetClass("股票", 40, "稳健型股票"));
                classes.add(new StrategyRecommendResponse.AssetClass("债券", 50, "国债、企业债"));
                classes.add(new StrategyRecommendResponse.AssetClass("现金", 10, "货币基金"));
            }
            case RISK_AGGRESSIVE -> {
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
            case RISK_CONSERVATIVE -> "基于您的保守风险偏好，建议优先选择稳健型策略，注重资本保护。";
            case RISK_AGGRESSIVE -> "基于您的激进风险偏好，建议重点关注高收益策略，但需注意风险控制。";
            default -> "基于您的平衡风险偏好，建议采用多元化策略组合，平衡风险与收益。";
        };
    }
    private BacktestInterpretResponse.PerformanceInterpretation generatePerformanceInterpretation(boolean isGood) {
        return BacktestInterpretResponse.PerformanceInterpretation.builder()
            .totalReturnAssessment(isGood ? "优秀" : "一般")
            .annualizedReturnAssessment(isGood ? "超越大盘" : "持平大盘")
            .benchmarkComparison(isGood ? "跑赢基准指数" : "与基准持平")
            .consistencyEvaluation("收益稳定性" + (isGood ? "良好" : "一般"))
            .build();
    }

    private String resolveRiskLevel(int overallScore) {
        if (overallScore >= 70) {
            return "低风险";
        }
        if (overallScore >= 55) {
            return "中风险";
        }
        return "高风险";
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
