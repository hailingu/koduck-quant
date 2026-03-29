package com.koduck.dto.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.List;

/**
 * AI  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatStreamRequest {

    @Builder.Default
    private String provider = "minimax";

    /**
     * Optional model name. When blank, provider default model will be used.
     */
    private String model;

    private String apiKey;

    private String apiBase;

    /**
     * Chat session id for memory retrieval/writeback.
     */
    private String sessionId;

    /**
     * Agent role id used by runtime (e.g. general/architect/coder/reviewer/analyst).
     */
    @Builder.Default
    private String role = "general";

    /**
     * Optional runtime options passed through to koduck-agent.
     */
    private Map<String, Object> runtime;

    /**
     * Keep backward compatibility: when true, backend injects no-tool guard prompt.
     */
    @Builder.Default
    private Boolean disableToolCalls = false;

    @Valid
    @NotEmpty(message = "消息列表不能为空")
    private List<ChatMessageRequest> messages;
}
