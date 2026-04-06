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
import com.koduck.market.service.StockSubscriptionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket 事件控制器。
 * <p>处理 WebSocket 实时订阅相关事件：</p>
 * <ul>
 *   <li>股票行情订阅/取消订阅</li>
 *   <li>心跳检测</li>
 *   <li>会话管理</li>
 * </ul>
 *
 * @author GitHub Copilot
 */
@Slf4j
@Controller
@Tag(name = "WebSocket", description = "WebSocket real-time quote subscription interface (via STOMP protocol)")
public class WebSocketEventController {

    /**
     * 订阅结果类型。
     */
    private static final String SUBSCRIBE_RESULT = "SUBSCRIBE_RESULT";

    /**
     * 取消订阅结果类型。
     */
    private static final String UNSUBSCRIBE_RESULT = "UNSUBSCRIBE_RESULT";

    /**
     * 股票订阅服务。
     */
    private final StockSubscriptionService stockSubscriptionService;

    /**
     * 对象映射器。
     */
    private final ObjectMapper objectMapper;

    public WebSocketEventController(StockSubscriptionService stockSubscriptionService, ObjectMapper objectMapper) {
        this.stockSubscriptionService = Objects.requireNonNull(stockSubscriptionService,
                "stockSubscriptionService must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
    }

    /**
     * 用户 ID 到会话 ID 的映射。
     */
    private final Map<Long, String> activeConnections = new ConcurrentHashMap<>();

    /**
     * 处理订阅请求。
     *
     * @param payload 订阅请求体
     * @param headerAccessor 消息头访问器
     * @return 订阅结果
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
     * 处理取消订阅请求。
     *
     * @param payload 取消订阅请求体
     * @param headerAccessor 消息头访问器
     * @return 取消订阅结果
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
     * 处理心跳 ping 消息。
     *
     * @param headerAccessor 消息头访问器
     * @return pong 响应
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
     * 处理会话连接事件。
     *
     * @param event 会话连接事件
     */
    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        log.info("websocket_session_connect headers={}", event.getMessage().getHeaders());
    }

    /**
     * 处理会话断开事件 - 清理订阅。
     *
     * @param event 会话断开事件
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
     * 处理订阅事件。
     *
     * @param event 会话订阅事件
     */
    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        log.info("websocket_session_subscribe headers={}", event.getMessage().getHeaders());
    }

    /**
     * 获取 Principal。
     *
     * @param headerAccessor 消息头访问器
     * @return WebSocket 用户 principal
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
     * 获取活跃连接数。
     *
     * @return 活跃连接数量
     */
    public int getActiveConnectionCount() {
        return activeConnections.size();
    }
}
