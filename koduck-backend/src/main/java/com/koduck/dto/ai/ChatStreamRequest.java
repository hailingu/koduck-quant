package com.koduck.dto.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 流式聊天请求 DTO。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatStreamRequest {

    @Builder.Default
    private String provider = "minimax";

    private String apiKey;

    private String apiBase;

    private QqBotConfigRequest qqBot;

    @Valid
    @NotEmpty(message = "消息列表不能为空")
    private List<ChatMessageRequest> messages;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QqBotConfigRequest {
        private Boolean enabled;
        private String appId;
        private String clientSecret;
        private String apiBase;
        private String tokenPath;
        private String sendUrlTemplate;
        private String defaultTargetId;
        private String targetPlaceholder;
        private String contentField;
        private Integer msgType;
        private Integer tokenTtlBufferSeconds;
    }
}
