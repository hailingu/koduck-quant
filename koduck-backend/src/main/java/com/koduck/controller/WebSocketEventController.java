package com.koduck.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.config.WebSocketChannelInterceptor;
import com.koduck.dto.websocket.SubscriptionMessage;
import com.koduck.dto.websocket.WebSocketMessage;
import com.koduck.service.StockSubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 
 *
 * <p> WebSocket ：</p>
 * <ul>
 *   <li>/</li>
 *   <li></li>
 *   <li></li>
 * </ul>
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class WebSocketEventController {

    private static final String SUBSCRIBE_RESULT = "SUBSCRIBE_RESULT";
    private static final String UNSUBSCRIBE_RESULT = "UNSUBSCRIBE_RESULT";

    private final StockSubscriptionService stockSubscriptionService;
    private final ObjectMapper objectMapper;

    /**
     * 
     * userId -> sessionId
     */
    private final Map<Long, String> activeConnections = new ConcurrentHashMap<>();

    /**
     * （）
     *
     * @param headerAccessor 
     * @return 
     */
    @MessageMapping("/subscribe")
    @SendToUser("/queue/subscribe-result")
    public SubscriptionMessage handleSubscribe(
            @Payload(required = false) Object payload,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("websocket_subscribe_request sessionId={}", headerAccessor.getSessionId());

        SubscriptionMessage request = parseSubscriptionMessage(payload);

        // 
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
            // 
            Set<String> subscriptions = stockSubscriptionService.getUserSubscriptions(userId);
            return SubscriptionMessage.builder()
                    .type(SUBSCRIBE_RESULT)
                    .subscriptions(new ArrayList<>(subscriptions))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }

        // 
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.subscribe(userId, symbols);

        // 
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
     * 
     *
     * @param headerAccessor 
     * @return 
     */
    @MessageMapping("/unsubscribe")
    @SendToUser("/queue/unsubscribe-result")
    public SubscriptionMessage handleUnsubscribe(
            @Payload(required = false) Object payload,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("websocket_unsubscribe_request sessionId={}", headerAccessor.getSessionId());

        SubscriptionMessage request = parseSubscriptionMessage(payload);

        // 
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

        // 
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.unsubscribe(userId, symbols);

        // 
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
     * /ping 
     *
     * @param headerAccessor 
     * @return 
     */
    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public WebSocketMessage handlePing(SimpMessageHeaderAccessor headerAccessor) {
        return WebSocketMessage.success("pong", "/app/ping",
                Map.of("timestamp", System.currentTimeMillis()));
    }

    /**
     * 
     */
    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        log.info("websocket_session_connect headers={}", event.getMessage().getHeaders());
    }

    /**
     *  - 
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.info("websocket_session_disconnect sessionId={}", sessionId);

        // 
        Long disconnectedUserId = null;
        for (Map.Entry<Long, String> entry : activeConnections.entrySet()) {
            if (entry.getValue().equals(sessionId)) {
                disconnectedUserId = entry.getKey();
                break;
            }
        }

        if (disconnectedUserId != null) {
            activeConnections.remove(disconnectedUserId);
            // 
            stockSubscriptionService.onUserDisconnect(disconnectedUserId);
            log.info("websocket_user_subscriptions_cleared userId={}", disconnectedUserId);
        }
    }

    /**
     * 
     */
    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        log.info("websocket_session_subscribe headers={}", event.getMessage().getHeaders());
    }

    /**
     *  Principal
     */
    private WebSocketChannelInterceptor.WebSocketUserPrincipal getUserPrincipal(SimpMessageHeaderAccessor headerAccessor) {
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
        } catch (Exception ex) {
            log.warn("websocket_subscription_message_parse_failed payloadType={} payload={} error={}",
                    payload == null ? null : payload.getClass().getName(),
                    payload,
                    ex.getMessage());
            return null;
        }
    }

    /**
     * 
     */
    public int getActiveConnectionCount() {
        return activeConnections.size();
    }
}
