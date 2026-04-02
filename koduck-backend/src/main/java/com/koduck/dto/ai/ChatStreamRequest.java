package com.koduck.dto.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Map;

import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

/**
 * AI 对话流请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class ChatStreamRequest {

    /**
     * 提供商，默认 minimax。
     */
    private String provider = "minimax";

    /**
     * 可选模型名称，为空时使用提供商默认模型。
     */
    private String model;

    /**
     * API密钥。
     */
    private String apiKey;

    /**
     * API基础地址。
     */
    private String apiBase;

    /**
     * 会话ID，用于记忆检索和写回。
     */
    private String sessionId;

    /**
     * 运行时角色ID（如 general/architect/coder/reviewer/analyst）。
     */
    private String role = "general";

    /**
     * 可选运行时选项，传递给 koduck-agent。
     */
    private Map<String, Object> runtime;

    /**
     * 保持向后兼容：为true时后端注入无工具守护提示词。
     */
    private Boolean disableToolCalls = false;

    /**
     * 消息列表。
     */
    @Valid
    @NotEmpty(message = "消息列表不能为空")
    private List<ChatMessageRequest> messages;

    /**
     * 获取运行时选项的副本。
     *
     * @return 运行时选项副本
     */
    public Map<String, Object> getRuntime() {
        return CollectionCopyUtils.copyMap(runtime);
    }

    /**
     * 设置运行时选项。
     *
     * @param runtime 运行时选项
     */
    public void setRuntime(Map<String, Object> runtime) {
        this.runtime = CollectionCopyUtils.copyMap(runtime);
    }

    /**
     * 获取消息列表的副本。
     *
     * @return 消息列表副本
     */
    public List<ChatMessageRequest> getMessages() {
        return CollectionCopyUtils.copyList(messages);
    }

    /**
     * 设置消息列表。
     *
     * @param messages 消息列表
     */
    public void setMessages(List<ChatMessageRequest> messages) {
        this.messages = CollectionCopyUtils.copyList(messages);
    }

    /**
     * 获取 Builder 实例。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder 类。
     */
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

        /**
         * 设置提供商。
         *
         * @param provider 提供商
         * @return Builder 实例
         */
        public Builder provider(String provider) {
            this.provider = provider;
            return this;
        }

        /**
         * 设置模型。
         *
         * @param model 模型名称
         * @return Builder 实例
         */
        public Builder model(String model) {
            this.model = model;
            return this;
        }

        /**
         * 设置 API 密钥。
         *
         * @param apiKey API 密钥
         * @return Builder 实例
         */
        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        /**
         * 设置 API 基础地址。
         *
         * @param apiBase API 基础地址
         * @return Builder 实例
         */
        public Builder apiBase(String apiBase) {
            this.apiBase = apiBase;
            return this;
        }

        /**
         * 设置会话ID。
         *
         * @param sessionId 会话ID
         * @return Builder 实例
         */
        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        /**
         * 设置角色。
         *
         * @param role 角色ID
         * @return Builder 实例
         */
        public Builder role(String role) {
            this.role = role;
            return this;
        }

        /**
         * 设置运行时选项。
         *
         * @param runtime 运行时选项
         * @return Builder 实例
         */
        public Builder runtime(Map<String, Object> runtime) {
            this.runtime = CollectionCopyUtils.copyMap(runtime);
            return this;
        }

        /**
         * 设置是否禁用工具调用。
         *
         * @param disableToolCalls 是否禁用
         * @return Builder 实例
         */
        public Builder disableToolCalls(Boolean disableToolCalls) {
            this.disableToolCalls = disableToolCalls;
            return this;
        }

        /**
         * 设置消息列表。
         *
         * @param messages 消息列表
         * @return Builder 实例
         */
        public Builder messages(List<ChatMessageRequest> messages) {
            this.messages = CollectionCopyUtils.copyList(messages);
            return this;
        }

        /**
         * 构建请求对象。
         *
         * @return ChatStreamRequest 实例
         */
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
