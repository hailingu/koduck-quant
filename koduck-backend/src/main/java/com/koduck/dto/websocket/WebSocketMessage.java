package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketMessage {

    /**
     * 
     */
    private String type;

    /**
     * /
     */
    private String destination;

    /**
     * 
     */
    private Object payload;

    /**
     * （）
     */
    private String error;

    /**
     * 
     */
    private Long timestamp;

    /**
     *  ID
     */
    private String messageId;

    /**
     * 
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
     * 
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
