package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 消息 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketMessage {

    /**
     * 消息类型
     */
    private String type;

    /**
     * 主题/目的地
     */
    private String destination;

    /**
     * 消息内容
     */
    private Object payload;

    /**
     * 错误信息（如果有）
     */
    private String error;

    /**
     * 时间戳
     */
    private Long timestamp;

    /**
     * 消息 ID
     */
    private String messageId;

    /**
     * 创建成功消息
     */
    public static WebSocketMessage success(String type, String destination, Object payload) {
        return WebSocketMessage.builder()
                .type(type)
                .destination(destination)
                .payload(payload)
                .timestamp(System.currentTimeMillis())
                .build();
    }

    /**
     * 创建错误消息
     */
    public static WebSocketMessage error(String type, String destination, String errorMessage) {
        return WebSocketMessage.builder()
                .type(type)
                .destination(destination)
                .error(errorMessage)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}
