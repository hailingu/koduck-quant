package com.koduck.controller;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.dto.websocket.SubscriptionMessage;
import com.koduck.dto.websocket.WebSocketMessage;
import com.koduck.security.websocket.WebSocketChannelInterceptor;
import com.koduck.service.StockSubscriptionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket event controller.
 * <p>Handles WebSocket real-time subscription related events:</p>
 * <ul>
 *   <li>Stock quote subscription/unsubscription</li>
 *   <li>Heartbeat detection</li>
 *   <li>Session management</li>
 * </ul>
 *
 * @author GitHub Copilot
 */
@Slf4j
@Controller
@Tag(name = "WebSocket", description = "WebSocket real-time quote subscription interface (via STOMP protocol)")
public class WebSocketEventController {

    /**
     * Subscribe result type.
     */
    private static final String SUBSCRIBE_RESULT = "SUBSCRIBE_RESULT";

    /**
     * Unsubscribe result type.
     */
    private static final String UNSUBSCRIBE_RESULT = "UNSUBSCRIBE_RESULT";

    /**
     * Stock subscription service.
     */
    private final StockSubscriptionService stockSubscriptionService;

    /**
     * Object mapper.
     */
    private final ObjectMapper objectMapper;

    public WebSocketEventController(StockSubscriptionService stockSubscriptionService, ObjectMapper objectMapper) {
        this.stockSubscriptionService = Objects.requireNonNull(stockSubscriptionService,
                "stockSubscriptionService must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
    }

    /**
     * Mapping from user ID to session ID.
     */
    private final Map<Long, String> activeConnections = new ConcurrentHashMap<>();

    /**
     * Handles subscription requests.
     *
     * @param payload subscription request body
     * @param headerAccessor message header accessor
     * @return subscription result
     */
    @Operation(
        summary = "Subscribe stock quotes",
        description = "Subscribe to real-time quotes for specified stocks\n\n" +
                      "STOMP destination: /app/subscribe\n" +
                      "Results received via /user/queue/subscribe-result"
    )
    @MessageMapping("/subscribe")
    @SendToUser("/queue/subscribe-result")
    public SubscriptionMessage handleSubscribe(
            @Payload(required = false) Object payload,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("websocket_subscribe_request sessionId={}", headerAccessor.getSessionId());
        SubscriptionMessage request = parseSubscriptionMessage(payload);
        // Get user Principal
        WebSocketChannelInterceptor.WebSocketUserPrincipal principal = getUserPrincipal(headerAccessor);
        if (principal == null) {
            return SubscriptionMessage.builder()
                    .type(SUBSCRIBE_RESULT)
                    .failed(Map.of("error", "User not authenticated"))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
        Long userId = principal.getUserId();
        activeConnections.put(userId, headerAccessor.getSessionId());
        List<String> symbols = request != null && request.getSymbols() != null
            ? request.getSymbols()
            : new ArrayList<>();
        // Frontend may publish UNSUBSCRIBE intent to /app/subscribe.
        if (request != null && "UNSUBSCRIBE".equalsIgnoreCase(request.getType())) {
            StockSubscriptionService.SubscribeResult result = stockSubscriptionService.unsubscribe(userId, symbols);
            Set<String> allSubscriptions = stockSubscriptionService.getUserSubscriptions(userId);
            return SubscriptionMessage.builder()
                .type(UNSUBSCRIBE_RESULT)
                .symbols(symbols)
                .success(result.getSuccess())
                .failed(result.getFailed())
                .subscriptions(new ArrayList<>(allSubscriptions))
                .timestamp(System.currentTimeMillis())
                .build();
        }
        if (symbols.isEmpty()) {
            // Query current subscriptions
            Set<String> subscriptions = stockSubscriptionService.getUserSubscriptions(userId);
            return SubscriptionMessage.builder()
                    .type(SUBSCRIBE_RESULT)
                    .subscriptions(new ArrayList<>(subscriptions))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
        // Execute subscription
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.subscribe(userId, symbols);
        // Return all current subscriptions
        Set<String> allSubscriptions = stockSubscriptionService.getUserSubscriptions(userId);
        return SubscriptionMessage.builder()
            .type(SUBSCRIBE_RESULT)
                .symbols(symbols)
                .success(result.getSuccess())
                .failed(result.getFailed())
                .subscriptions(new ArrayList<>(allSubscriptions))
                .timestamp(System.currentTimeMillis())
                .build();
    }

    /**
     * Handles unsubscribe requests.
     *
     * @param payload unsubscribe request body
     * @param headerAccessor message header accessor
     * @return unsubscribe result
     */
    @Operation(
        summary = "Unsubscribe stock quotes",
        description = "Cancel real-time quote subscription for specified stocks\n\n" +
                      "STOMP destination: /app/unsubscribe\n" +
                      "Results received via /user/queue/unsubscribe-result"
    )
    @MessageMapping("/unsubscribe")
    @SendToUser("/queue/unsubscribe-result")
    public SubscriptionMessage handleUnsubscribe(
            @Payload(required = false) Object payload,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("websocket_unsubscribe_request sessionId={}", headerAccessor.getSessionId());
        SubscriptionMessage request = parseSubscriptionMessage(payload);
        // Get user Principal
        WebSocketChannelInterceptor.WebSocketUserPrincipal principal = getUserPrincipal(headerAccessor);
        if (principal == null) {
            return SubscriptionMessage.builder()
                    .type(UNSUBSCRIBE_RESULT)
                    .failed(Map.of("error", "User not authenticated"))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
        Long userId = principal.getUserId();
        List<String> symbols = request != null && request.getSymbols() != null
            ? request.getSymbols()
            : new ArrayList<>();
        // Execute unsubscription
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.unsubscribe(userId, symbols);
        // Return all current subscriptions
        Set<String> allSubscriptions = stockSubscriptionService.getUserSubscriptions(userId);
        return SubscriptionMessage.builder()
            .type(UNSUBSCRIBE_RESULT)
                .symbols(symbols)
                .success(result.getSuccess())
                .failed(result.getFailed())
                .subscriptions(new ArrayList<>(allSubscriptions))
                .timestamp(System.currentTimeMillis())
                .build();
    }

    /**
     * Handles heartbeat ping messages.
     *
     * @param headerAccessor message header accessor
     * @return pong response
     */
    @Operation(
        summary = "WebSocket heartbeat detection",
        description = "Send heartbeat packet to detect connection status\n\n" +
                      "STOMP destination: /app/ping\n" +
                      "Response received via /user/queue/pong"
    )
    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public WebSocketMessage handlePing(SimpMessageHeaderAccessor headerAccessor) {
        return WebSocketMessage.success("pong", "/app/ping",
                Map.of("timestamp", System.currentTimeMillis()));
    }

    /**
     * Handles session connect event.
     *
     * @param event session connect event
     */
    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        log.info("websocket_session_connect headers={}", event.getMessage().getHeaders());
    }

    /**
     * Handles session disconnect event - cleanup subscriptions.
     *
     * @param event session disconnect event
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.info("websocket_session_disconnect sessionId={}", sessionId);
        // Find and clean up subscriptions for this session's user
        Long disconnectedUserId = null;
        for (Map.Entry<Long, String> entry : activeConnections.entrySet()) {
            if (entry.getValue().equals(sessionId)) {
                disconnectedUserId = entry.getKey();
                break;
            }
        }
        if (disconnectedUserId != null) {
            activeConnections.remove(disconnectedUserId);
            // Clean up user subscriptions
            stockSubscriptionService.onUserDisconnect(disconnectedUserId);
            log.info("websocket_user_subscriptions_cleared userId={}", disconnectedUserId);
        }
    }

    /**
     * Handles subscription event.
     *
     * @param event session subscribe event
     */
    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        log.info("websocket_session_subscribe headers={}", event.getMessage().getHeaders());
    }

    /**
     * Gets Principal.
     *
     * @param headerAccessor message header accessor
     * @return WebSocket user principal
     */
    private WebSocketChannelInterceptor.WebSocketUserPrincipal getUserPrincipal(
            SimpMessageHeaderAccessor headerAccessor) {
        if (headerAccessor.getUser() instanceof WebSocketChannelInterceptor.WebSocketUserPrincipal principal) {
            return principal;
        }
        return null;
    }

    private SubscriptionMessage parseSubscriptionMessage(Object payload) {
        try {
            if (payload instanceof SubscriptionMessage message) {
                return message;
            }
            if (payload instanceof String text) {
                if (text.isBlank()) {
                    return null;
                }
                return objectMapper.readValue(text, SubscriptionMessage.class);
            }
            if (payload instanceof byte[] bytes) {
                String text = new String(bytes, StandardCharsets.UTF_8);
                if (text.isBlank()) {
                    return null;
                }
                return objectMapper.readValue(text, SubscriptionMessage.class);
            }
            return objectMapper.convertValue(payload, SubscriptionMessage.class);
        }
        catch (Exception ex) {
            log.warn("websocket_subscription_message_parse_failed payloadType={} payload={} error={}",
                    payload == null ? null : payload.getClass().getName(),
                    payload,
                    ex.getMessage());
            return null;
        }
    }

    /**
     * Gets active connection count.
     *
     * @return number of active connections
     */
    public int getActiveConnectionCount() {
        return activeConnections.size();
    }
}
