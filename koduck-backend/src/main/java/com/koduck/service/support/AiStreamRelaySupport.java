package com.koduck.service.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.dto.ai.ChatStreamRequest;
import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Mono;

/**
 * Support component for relaying SSE stream from AI agent.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
@RequiredArgsConstructor
public class AiStreamRelaySupport {

    private static final String EVENT_MESSAGE = "message";
    private static final String EVENT_DONE = "done";
    private static final String KEY_CONTENT = "content";
    private static final TypeReference<Map<String, Object>> MAP_TYPE_REFERENCE = new TypeReference<>() {
    };

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public StreamRelayResult relayStreamEvents(String agentUrl,
                                               ChatStreamRequest normalizedRequest,
                                               SseEmitter emitter) {
        AtomicReference<String> finalAssistantContent = new AtomicReference<>(null);
        AtomicReference<Integer> finalTokenCount = new AtomicReference<>(null);

        StreamRelayResult relayResult = webClient.post()
            .uri(Objects.requireNonNull(agentUrl, "agentUrl must not be null"))
            .contentType(Objects.requireNonNull(MediaType.APPLICATION_JSON, "application/json media type must not be null"))
            .accept(Objects.requireNonNull(MediaType.TEXT_EVENT_STREAM, "text/event-stream media type must not be null"))
            .bodyValue(Objects.requireNonNull(normalizedRequest, "normalizedRequest must not be null"))
            .exchangeToMono(response -> {
                if (response.statusCode().isError()) {
                    return response.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .flatMap(detail -> Mono.error(
                            new StreamRelayException(response.statusCode().value(),
                                detail.isBlank() ? "unknown error" : detail)
                        ));
                }
                return response.bodyToFlux(String.class)
                    .doOnNext(rawChunk -> {
                        if (rawChunk == null || rawChunk.isBlank()) {
                            return;
                        }
                        try {
                            processSseChunk(rawChunk, emitter, finalAssistantContent, finalTokenCount);
                        } catch (IOException exception) {
                            throw new IllegalStateException("Failed to forward SSE chunk", exception);
                        }
                    })
                    .then(Mono.fromSupplier(() -> new StreamRelayResult(finalAssistantContent.get(),
                        finalTokenCount.get())));
            })
            .block();

        return relayResult != null ? relayResult : new StreamRelayResult(null, null);
    }

    private void processSseChunk(String rawChunk,
                                 SseEmitter emitter,
                                 AtomicReference<String> finalAssistantContent,
                                 AtomicReference<Integer> finalTokenCount) throws IOException {
        String[] events = rawChunk.split("\\r?\\n\\r?\\n");
        for (String eventBlock : events) {
            ParsedSseEvent parsedEvent = parseSseEvent(eventBlock);
            if (parsedEvent != null) {
                updateRelayResult(parsedEvent, finalAssistantContent, finalTokenCount);
                sendSseEvent(emitter, parsedEvent.eventName(), parsedEvent.payload());
            }
        }
    }

    private ParsedSseEvent parseSseEvent(String eventBlock) {
        if (eventBlock == null || eventBlock.isBlank()) {
            return null;
        }
        String eventName = EVENT_MESSAGE;
        StringBuilder dataBuilder = new StringBuilder();
        String[] lines = eventBlock.split("\\r?\\n");
        for (String line : lines) {
            if (line.startsWith("event:")) {
                eventName = line.substring("event:".length()).trim();
            } else if (line.startsWith("data:")) {
                appendSseData(dataBuilder, line);
            }
        }
        if (dataBuilder.isEmpty()) {
            return null;
        }
        return new ParsedSseEvent(eventName, dataBuilder.toString());
    }

    private void appendSseData(StringBuilder dataBuilder, String line) {
        if (!dataBuilder.isEmpty()) {
            dataBuilder.append('\n');
        }
        dataBuilder.append(line.substring("data:".length()).trim());
    }

    private void updateRelayResult(ParsedSseEvent parsedEvent,
                                   AtomicReference<String> finalAssistantContent,
                                   AtomicReference<Integer> finalTokenCount) {
        if (EVENT_DONE.equals(parsedEvent.eventName())) {
            finalAssistantContent.set(extractAssistantContent(parsedEvent.payload()));
            finalTokenCount.set(extractTokenUsage(parsedEvent.payload()));
        }
    }

    private void sendSseEvent(SseEmitter emitter, String eventName, Object data) throws IOException {
        String nonNullEventName = Objects.requireNonNull(eventName, "eventName must not be null");
        Object nonNullData = Objects.requireNonNull(data, "data must not be null");
        emitter.send(SseEmitter.event().name(nonNullEventName).data(nonNullData));
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
            Map<String, Object> usage = objectMapper.convertValue(usageObject, MAP_TYPE_REFERENCE);
            if (usage != null && usage.get("total_tokens") != null) {
                Object totalTokens = usage.get("total_tokens");
                if (totalTokens instanceof Number number) {
                    return number.intValue();
                }
            }
            return null;
        } catch (IOException | RuntimeException _) {
            return null;
        }
    }

    public record StreamRelayResult(String assistantContent, Integer tokenCount) {
    }

    public static final class StreamRelayException extends RuntimeException {
        private final int statusCode;
        private final String detail;

        public StreamRelayException(int statusCode, String detail) {
            super(detail);
            this.statusCode = statusCode;
            this.detail = detail;
        }

        public int statusCode() {
            return statusCode;
        }

        public String detail() {
            return detail;
        }
    }

    private record ParsedSseEvent(String eventName, String payload) {
    }
}
