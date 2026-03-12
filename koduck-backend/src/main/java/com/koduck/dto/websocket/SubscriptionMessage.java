package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * WebSocket 
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /**
     *  SUBSCRIBE / UNSUBSCRIBE
     */
    private String type;

    /**
     * 
     */
    private List<String> symbols;

    /**
     * 
     */
    private List<String> success;

    /**
     * 
     */
    private Map<String, String> failed;

    /**
     * 
     */
    private List<String> subscriptions;

    /**
     * 
     */
    private Long timestamp;
}
