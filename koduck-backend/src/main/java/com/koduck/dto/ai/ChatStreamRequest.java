package com.koduck.dto.ai;

import com.koduck.util.CollectionCopyUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.List;

/**
 * AI  DTO
 */
@Data
@NoArgsConstructor
public class ChatStreamRequest {

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
    private String role = "general";

    /**
     * Optional runtime options passed through to koduck-agent.
     */
    private Map<String, Object> runtime;

    /**
     * Keep backward compatibility: when true, backend injects no-tool guard prompt.
     */
    private Boolean disableToolCalls = false;

    @Valid
    @NotEmpty(message = "消息列表不能为空")
    private List<ChatMessageRequest> messages;

    public Map<String, Object> getRuntime() {
        return CollectionCopyUtils.copyMap(runtime);
    }

    public void setRuntime(Map<String, Object> runtime) {
        this.runtime = CollectionCopyUtils.copyMap(runtime);
    }

    public List<ChatMessageRequest> getMessages() {
        return CollectionCopyUtils.copyList(messages);
    }

    public void setMessages(List<ChatMessageRequest> messages) {
        this.messages = CollectionCopyUtils.copyList(messages);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String provider = "minimax";
        private String model;
        private String apiKey;
        private String apiBase;
        private String sessionId;
        private String role = "general";
        private Map<String, Object> runtime;
        private Boolean disableToolCalls = false;
        private List<ChatMessageRequest> messages;

        public Builder provider(String provider) {
            this.provider = provider;
            return this;
        }

        public Builder model(String model) {
            this.model = model;
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder apiBase(String apiBase) {
            this.apiBase = apiBase;
            return this;
        }

        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        public Builder role(String role) {
            this.role = role;
            return this;
        }

        public Builder runtime(Map<String, Object> runtime) {
            this.runtime = CollectionCopyUtils.copyMap(runtime);
            return this;
        }

        public Builder disableToolCalls(Boolean disableToolCalls) {
            this.disableToolCalls = disableToolCalls;
            return this;
        }

        public Builder messages(List<ChatMessageRequest> messages) {
            this.messages = CollectionCopyUtils.copyList(messages);
            return this;
        }

        public ChatStreamRequest build() {
            ChatStreamRequest request = new ChatStreamRequest();
            request.provider = provider;
            request.model = model;
            request.apiKey = apiKey;
            request.apiBase = apiBase;
            request.sessionId = sessionId;
            request.role = role;
            request.runtime = CollectionCopyUtils.copyMap(runtime);
            request.disableToolCalls = disableToolCalls;
            request.messages = CollectionCopyUtils.copyList(messages);
            return request;
        }
    }
}
