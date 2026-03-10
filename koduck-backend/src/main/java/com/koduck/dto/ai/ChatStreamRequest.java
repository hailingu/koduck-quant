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

    @Valid
    @NotEmpty(message = "消息列表不能为空")
    private List<ChatMessageRequest> messages;
}

