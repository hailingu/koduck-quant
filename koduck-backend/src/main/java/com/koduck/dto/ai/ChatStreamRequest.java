package com.koduck.dto.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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

    private String apiKey;

    private String apiBase;

    /**
     * Agent role id used by runtime (e.g. general/architect/coder/reviewer/analyst).
     */
    @Builder.Default
    private String role = "general";

    @Valid
    @NotEmpty(message = "消息列表不能为空")
    private List<ChatMessageRequest> messages;
}
