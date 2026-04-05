package com.koduck.dto.ai;

import jakarta.validation.constraints.NotBlank;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * AI chat message request DTO.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageRequest {

    /** Message role (e.g., user, assistant, system). */
    @NotBlank(message = "消息角色不能为空")
    private String role;

    /** Message content. */
    @NotBlank(message = "消息内容不能为空")
    private String content;
}
