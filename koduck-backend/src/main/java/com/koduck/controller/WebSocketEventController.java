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
 * WebSocket 事件控制器
 * <p>处理 WebSocket 实时订阅相关的事件：</p>
 * <ul>
 *   <li>股票行情订阅/取消订阅</li>
 *   <li>心跳检测</li>
 *   <li>会话管理</li>
 * </ul>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Slf4j
@Controller
@Tag(name = "WebSocket", description = "WebSocket实时行情订阅接口（通过STOMP协议）")
public class WebSocketEventController {
    private static final String SUBSCRIBE_RESULT = "SUBSCRIBE_RESULT";
    private static final String UNSUBSCRIBE_RESULT = "UNSUBSCRIBE_RESULT";
    private final StockSubscriptionService stockSubscriptionService;
    private final ObjectMapper objectMapper;

    public WebSocketEventController(StockSubscriptionService stockSubscriptionService, ObjectMapper objectMapper) {
        this.stockSubscriptionService = Objects.requireNonNull(stockSubscriptionService,
                "stockSubscriptionService must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
    }

    /**
     * 用户ID到会话ID的映射
     */
    private final Map<Long, String> activeConnections = new ConcurrentHashMap<>();

    /**
     * 处理订阅请求
     *
     * @param payload 订阅请求体
     * @param headerAccessor 消息头访问器
     * @return 订阅结果
     */
    @Operation(
        summary = "订阅股票行情",
        description = "订阅指定股票的实时行情推送\n\n" +
                      "STOMP目的地: /app/subscribe\n" +
                      "订阅成功后通过 /user/queue/subscribe-result 接收结果"
    )
    @MessageMapping("/subscribe")
    @SendToUser("/queue/subscribe-result")
    public SubscriptionMessage handleSubscribe(
            @Payload(required = false) Object payload,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("websocket_subscribe_request sessionId={}", headerAccessor.getSessionId());
        SubscriptionMessage request = parseSubscriptionMessage(payload);
        // 获取用户Principal
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
            // 查询当前订阅
            Set<String> subscriptions = stockSubscriptionService.getUserSubscriptions(userId);
            return SubscriptionMessage.builder()
                    .type(SUBSCRIBE_RESULT)
                    .subscriptions(new ArrayList<>(subscriptions))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
        // 执行订阅
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.subscribe(userId, symbols);
        // 返回当前所有订阅
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
     * 处理取消订阅请求
     *
     * @param payload 取消订阅请求体
     * @param headerAccessor 消息头访问器
     * @return 取消订阅结果
     */
    @Operation(
        summary = "取消订阅股票行情",
        description = "取消指定股票的实时行情推送\n\n" +
                      "STOMP目的地: /app/unsubscribe\n" +
                      "结果通过 /user/queue/unsubscribe-result 接收"
    )
    @MessageMapping("/unsubscribe")
    @SendToUser("/queue/unsubscribe-result")
    public SubscriptionMessage handleUnsubscribe(
            @Payload(required = false) Object payload,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("websocket_unsubscribe_request sessionId={}", headerAccessor.getSessionId());
        SubscriptionMessage request = parseSubscriptionMessage(payload);
        // 获取用户Principal
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
        // 执行取消订阅
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.unsubscribe(userId, symbols);
        // 返回当前所有订阅
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
     * 处理心跳 ping 消息
     *
     * @param headerAccessor 消息头访问器
     * @return pong 响应
     */
    @Operation(
        summary = "WebSocket心跳检测",
        description = "发送心跳包检测连接状态\n\n" +
                      "STOMP目的地: /app/ping\n" +
                      "响应通过 /user/queue/pong 接收"
    )
    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public WebSocketMessage handlePing(SimpMessageHeaderAccessor headerAccessor) {
        return WebSocketMessage.success("pong", "/app/ping",
                Map.of("timestamp", System.currentTimeMillis()));
    }

    /**
     * 处理会话连接事件
     */
    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        log.info("websocket_session_connect headers={}", event.getMessage().getHeaders());
    }

    /**
     * 处理会话断开事件 - 清理订阅
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.info("websocket_session_disconnect sessionId={}", sessionId);
        // 查找并清理该会话对应的用户订阅
        Long disconnectedUserId = null;
        for (Map.Entry<Long, String> entry : activeConnections.entrySet()) {
            if (entry.getValue().equals(sessionId)) {
                disconnectedUserId = entry.getKey();
                break;
            }
        }
        if (disconnectedUserId != null) {
            activeConnections.remove(disconnectedUserId);
            // 清理用户订阅
            stockSubscriptionService.onUserDisconnect(disconnectedUserId);
            log.info("websocket_user_subscriptions_cleared userId={}", disconnectedUserId);
        }
    }

    /**
     * 处理订阅事件
     */
    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        log.info("websocket_session_subscribe headers={}", event.getMessage().getHeaders());
    }

    /**
     * 获取 Principal
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
     * 获取活跃连接数
     */
    public int getActiveConnectionCount() {
        return activeConnections.size();
    }
}
