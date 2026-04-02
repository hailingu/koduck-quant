package com.koduck.service.support;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.ai.ChatMessageRequest;
import com.koduck.dto.ai.ChatStreamRequest;
import com.koduck.dto.indicator.IndicatorResponse;
import com.koduck.entity.MemoryChatMessage;
import com.koduck.entity.UserMemoryProfile;
import com.koduck.service.MemoryService;
import com.koduck.service.TechnicalIndicatorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Support component for chat memory/context enrichment.
 *
 * @author GitHub Copilot
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AiConversationSupport {

    /** Max lines for recent messages. */
    private static final int MAX_RECENT_MESSAGE_LINES = 8;
    /** Content truncation length. */
    private static final int CONTENT_TRUNCATION_LENGTH = 180;
    /** EMA short period. */
    private static final int EMA_SHORT_PERIOD = 20;
    /** EMA long period. */
    private static final int EMA_LONG_PERIOD = 60;
    /** MACD period. */
    private static final int MACD_PERIOD = 12;
    /** Max watch symbols. */
    private static final int MAX_WATCH_SYMBOLS = 30;

    /** Memory service. */
    private final MemoryService memoryService;
    /** Technical indicator service. */
    private final TechnicalIndicatorService technicalIndicatorService;

    public String resolveSessionId(String sessionId) {
        return memoryService.resolveSessionId(sessionId);
    }

    public ChatStreamRequest enrichWithMemoryContext(Long userId, ChatStreamRequest request) {
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
            log.debug("Injected memory context: user={}, session={}, recentMessages={}", userId, sessionId,
                recentMessages.size());
            return appendInstructionToSystem(request, memoryContext);
        }
        catch (Exception e) {
            log.warn("Failed to inject memory context, fallback to original request: {}", e.getMessage());
            return request;
        }
    }

    public ChatStreamRequest enrichWithQuantSignalIfNeeded(
            ChatStreamRequest request,
            Pattern symbolPattern) {
        try {
            ChatMessageRequest latestUserMessage = findLatestUserMessage(request.getMessages());
            if (latestUserMessage == null) {
                return request;
            }
            String question = latestUserMessage.getContent();
            if (!shouldAttachQuantSignal(question)) {
                return request;
            }
            String symbol = extractSymbol(question, symbolPattern);
            if (symbol == null) {
                symbol = extractSymbolFromMessages(request.getMessages(), symbolPattern);
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
        }
        catch (Exception e) {
            log.warn("Failed to enrich chat with quant signal, fallback to original request: {}", e.getMessage());
            return request;
        }
    }

    public ChatStreamRequest appendInstructionToSystem(ChatStreamRequest request, String instruction) {
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

    public ChatMessageRequest findLatestUserMessage(List<ChatMessageRequest> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            ChatMessageRequest msg = messages.get(i);
            if ("user".equalsIgnoreCase(msg.getRole())) {
                return msg;
            }
        }
        return null;
    }

    public void scheduleUserMemoryWriteBack(
            Long userId,
            ChatStreamRequest request,
            Pattern symbolPattern,
            String riskAggressive,
            String riskConservative,
            String riskBalanced) {
        if (!memoryService.isEnabled()) {
            return;
        }
        ChatMessageRequest latestUserMessage = findLatestUserMessage(request.getMessages());
        if (latestUserMessage == null || latestUserMessage.getContent() == null
            || latestUserMessage.getContent().isBlank()) {
            return;
        }
        String sessionId = memoryService.resolveSessionId(request.getSessionId());
        String content = latestUserMessage.getContent().trim();
        CompletableFuture.runAsync(() -> {
            try {
                memoryService.appendMessage(userId, sessionId, "user", content, null, Map.of("source", "chat-stream"));
                updateUserProfileFromConversation(userId, content, symbolPattern, riskAggressive, riskConservative,
                    riskBalanced);
            }
            catch (Exception e) {
                log.warn("Skip user memory writeback due to error: {}", e.getMessage());
            }
        });
    }

    public void scheduleAssistantMemoryWriteBack(Long userId, ChatStreamRequest request, String content,
                                                 Integer tokenCount) {
        if (!memoryService.isEnabled()) {
            return;
        }
        String sessionId = memoryService.resolveSessionId(request.getSessionId());
        CompletableFuture.runAsync(() -> {
            try {
                memoryService.appendMessage(userId, sessionId, "assistant", content, tokenCount,
                    Map.of("source", "chat-stream"));
            }
            catch (Exception e) {
                log.warn("Skip assistant memory writeback due to error: {}", e.getMessage());
            }
        });
    }

    private String buildMemoryContext(String sessionId,
                                      List<MemoryChatMessage> recentMessages,
                                      UserMemoryProfile profile) {
        StringBuilder builder = new StringBuilder();
        builder.append("【Memory Context】\n");
        builder.append("session_id: ").append(sessionId).append("\n");
        boolean hasProfile = appendProfileMemoryContext(builder, profile);
        boolean hasRecent = appendRecentMessagesContext(builder, recentMessages);
        if (!hasProfile && !hasRecent) {
            return "";
        }
        String result = builder.toString().trim();
        return result + "\n请把以上内容视为会话记忆，仅用于提升连续性，不要编造不存在的事实。";
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
        int maxLines = Math.min(recentMessages.size(), MAX_RECENT_MESSAGE_LINES);
        int startIndex = Math.max(0, recentMessages.size() - maxLines);
        for (int i = startIndex; i < recentMessages.size(); i++) {
            MemoryChatMessage item = recentMessages.get(i);
            String role = item == null || item.getRole() == null ? "unknown" : item.getRole();
            String content = normalizeContent(item == null ? null : item.getContent());
            builder.append("- ").append(role).append(": ").append(content).append("\n");
        }
        return true;
    }

    private String normalizeContent(String content) {
        String safeContent = content == null ? "" : content.trim();
        if (safeContent.length() > CONTENT_TRUNCATION_LENGTH) {
            return safeContent.substring(0, CONTENT_TRUNCATION_LENGTH) + "...";
        }
        return safeContent;
    }

    private List<ChatMessageRequest> mergeSystemInstruction(List<ChatMessageRequest> originalMessages,
                                                            String instruction) {
        List<ChatMessageRequest> updatedMessages = new ArrayList<>(originalMessages.size() + 1);
        boolean merged = false;
        for (int i = 0; i < originalMessages.size(); i++) {
            ChatMessageRequest msg = originalMessages.get(i);
            if (!merged && "system".equalsIgnoreCase(msg.getRole())) {
                String existing = msg.getContent() == null ? "" : msg.getContent();
                String mergedContent = existing.isBlank() ? instruction : existing + "\n\n" + instruction;
                updatedMessages.add(ChatMessageRequest.builder().role(msg.getRole()).content(mergedContent).build());
                merged = true;
            }
            else {
                updatedMessages.add(msg);
            }
        }
        if (!merged) {
            updatedMessages.add(0, ChatMessageRequest.builder().role("system").content(instruction).build());
        }
        return updatedMessages;
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
                String mergedContent = existing + "\n\n【自动量化信号】\n" + instruction
                    + "\n\n请优先基于上述量化信号给出结论（方向、入场/观望、风险位），不要再说\"没有实时数据\"。";
                updatedMessages.add(0, ChatMessageRequest.builder().role(msg.getRole()).content(mergedContent).build());
                merged = true;
            }
            else {
                updatedMessages.add(0, msg);
            }
        }
        return rebuildChatStreamRequest(request, updatedMessages);
    }

    private boolean shouldAttachQuantSignal(String question) {
        if (question == null) {
            return false;
        }
        String text = question.toLowerCase(Locale.ROOT);
        return text.contains("策略") || text.contains("买点") || text.contains("卖点") || text.contains("信号")
            || text.contains("入场") || text.contains("出场") || text.contains("做多") || text.contains("做空")
            || text.contains("trend") || text.contains("signal");
    }

    private String extractSymbolFromMessages(List<ChatMessageRequest> messages, Pattern symbolPattern) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            String symbol = extractSymbol(messages.get(i).getContent(), symbolPattern);
            if (symbol != null) {
                return symbol;
            }
        }
        return null;
    }

    private String extractSymbol(String text, Pattern symbolPattern) {
        if (text == null) {
            return null;
        }
        Matcher matcher = symbolPattern.matcher(text);
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }

    private String buildQuantSignalContext(String symbol, String market) {
        IndicatorResponse ema20 = technicalIndicatorService.calculateIndicator(market, symbol, "EMA", EMA_SHORT_PERIOD);
        IndicatorResponse ema60 = technicalIndicatorService.calculateIndicator(market, symbol, "EMA", EMA_LONG_PERIOD);
        IndicatorResponse macd = technicalIndicatorService.calculateIndicator(market, symbol, "MACD", MACD_PERIOD);
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
        }
        else if ("SHORT_BIAS".equals(direction) && "MOMENTUM_DOWN".equals(momentum)) {
            action = "REDUCE_OR_WAIT";
        }
        else {
            action = "NEUTRAL_WAIT_CONFIRM";
        }
        return String.format(Locale.ROOT,
            "量化信号上下文(自动注入): symbol=%s, market=%s, EMA20=%s, EMA60=%s, MACD=%s,"
                + " SIGNAL=%s, HIST=%s, direction=%s, momentum=%s, action=%s。"
                + "请把这个信号作为参考之一，明确提示风险，不要给出确定性收益承诺。",
            symbol, market, ema20Value.toPlainString(), ema60Value.toPlainString(),
            macdValue.toPlainString(), signalValue.toPlainString(),
            hist.toPlainString(), direction, momentum, action);
    }

    private BigDecimal getIndicatorValue(IndicatorResponse response, String key) {
        if (response == null || response.values() == null) {
            return null;
        }
        return response.values().get(key);
    }

    private void updateUserProfileFromConversation(Long userId, String latestUserMessage, Pattern symbolPattern,
                                                   String riskAggressive, String riskConservative,
                                                   String riskBalanced) {
        if (latestUserMessage == null || latestUserMessage.isBlank()) {
            return;
        }
        UserMemoryProfile existing = memoryService.getOrCreateProfile(userId);
        String riskPreference = existing.getRiskPreference();
        if (latestUserMessage.contains("激进")) {
            riskPreference = riskAggressive;
        }
        else if (latestUserMessage.contains("保守")) {
            riskPreference = riskConservative;
        }
        else if (latestUserMessage.contains("稳健")) {
            riskPreference = riskBalanced;
        }
        Set<String> watchSymbols = new LinkedHashSet<>(
            existing.getWatchSymbols() != null ? existing.getWatchSymbols() : List.of());
        Matcher matcher = symbolPattern.matcher(latestUserMessage);
        while (matcher.find()) {
            watchSymbols.add(matcher.group());
            if (watchSymbols.size() >= MAX_WATCH_SYMBOLS) {
                break;
            }
        }
        Set<String> preferredSources = new LinkedHashSet<>(
            existing.getPreferredSources() != null ? existing.getPreferredSources() : List.of());
        if (latestUserMessage.contains("财联社")) {
            preferredSources.add("cls");
        }
        if (latestUserMessage.contains("第一财经")) {
            preferredSources.add("yicai");
        }
        memoryService.upsertProfile(userId, riskPreference, new ArrayList<>(watchSymbols),
            new ArrayList<>(preferredSources), existing.getProfileFacts());
    }
}
