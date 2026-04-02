package com.koduck.dto.websocket;
import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 通用消息 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketMessage {

    /** 消息类型。 */
    private String type;

    /** 消息目标地址。 */
    private String destination;

    /** 消息负载数据。 */
    private Object payload;

    /** 错误信息（如果有）。 */
    private String error;

    /** 消息时间戳。 */
    private Long timestamp;

    /** 消息唯一标识。 */
    private String messageId;

    /**
     * 创建成功响应消息。
     *
     * @param type        消息类型
     * @param destination 目标地址
     * @param payload     负载数据
     * @return WebSocketMessage 实例
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
     * 创建错误响应消息。
     *
     * @param type         消息类型
     * @param destination  目标地址
     * @param errorMessage 错误信息
     * @return WebSocketMessage 实例
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
