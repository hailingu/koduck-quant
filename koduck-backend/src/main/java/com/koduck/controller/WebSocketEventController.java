package com.koduck.controller;

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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 消息控制器
 *
 * <p>处理客户端发送的 WebSocket 消息：</p>
 * <ul>
 *   <li>订阅/取消订阅股票</li>
 *   <li>心跳检测</li>
 *   <li>连接事件处理</li>
 * </ul>
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class WebSocketEventController {

    private final StockSubscriptionService stockSubscriptionService;

    /**
     * 存储活跃连接的用户
     * userId -> sessionId
     */
    private final Map<Long, String> activeConnections = new ConcurrentHashMap<>();

    /**
     * 处理订阅请求（批量订阅股票）
     *
     * @param headerAccessor 消息头部访问器
     * @return 订阅结果
     */
    @MessageMapping("/subscribe")
    @SendToUser("/queue/subscribe-result")
    public SubscriptionMessage handleSubscribe(
            @Payload(required = false) SubscriptionMessage request,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("用户订阅请求, sessionId={}", headerAccessor.getSessionId());

        // 获取用户信息
        WebSocketChannelInterceptor.WebSocketUserPrincipal principal = getUserPrincipal(headerAccessor);
        if (principal == null) {
            return SubscriptionMessage.builder()
                    .type("SUBSCRIBE_RESULT")
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
                .type("UNSUBSCRIBE_RESULT")
                .symbols(symbols)
                .success(result.getSuccess())
                .failed(result.getFailed())
                .subscriptions(new ArrayList<>(allSubscriptions))
                .timestamp(System.currentTimeMillis())
                .build();
        }

        if (symbols.isEmpty()) {
            // 返回当前订阅列表
            Set<String> subscriptions = stockSubscriptionService.getUserSubscriptions(userId);
            return SubscriptionMessage.builder()
                    .type("SUBSCRIBE_RESULT")
                    .subscriptions(new ArrayList<>(subscriptions))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }

        // 执行订阅
        StockSubscriptionService.SubscribeResult result = stockSubscriptionService.subscribe(userId, symbols);

        // 返回当前所有订阅
        Set<String> allSubscriptions = stockSubscriptionService.getUserSubscriptions(userId);

        return SubscriptionMessage.builder()
                .type("SUBSCRIBE_RESULT")
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
     * @param headerAccessor 消息头部访问器
     * @return 取消订阅结果
     */
    @MessageMapping("/unsubscribe")
    @SendToUser("/queue/unsubscribe-result")
    public SubscriptionMessage handleUnsubscribe(
            @Payload(required = false) SubscriptionMessage request,
            SimpMessageHeaderAccessor headerAccessor) {
        log.info("用户取消订阅请求, sessionId={}", headerAccessor.getSessionId());

        // 获取用户信息
        WebSocketChannelInterceptor.WebSocketUserPrincipal principal = getUserPrincipal(headerAccessor);
        if (principal == null) {
            return SubscriptionMessage.builder()
                    .type("UNSUBSCRIBE_RESULT")
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
                .type("UNSUBSCRIBE_RESULT")
                .symbols(symbols)
                .success(result.getSuccess())
                .failed(result.getFailed())
                .subscriptions(new ArrayList<>(allSubscriptions))
                .timestamp(System.currentTimeMillis())
                .build();
    }

    /**
     * 处理心跳/ping 请求
     *
     * @param headerAccessor 消息头部访问器
     * @return 心跳响应
     */
    @MessageMapping("/ping")
    @SendToUser("/queue/pong")
    public WebSocketMessage handlePing(SimpMessageHeaderAccessor headerAccessor) {
        return WebSocketMessage.success("pong", "/app/ping",
                Map.of("timestamp", System.currentTimeMillis()));
    }

    /**
     * 处理连接事件
     */
    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        log.info("WebSocket 连接事件: {}", event.getMessage().getHeaders());
    }

    /**
     * 处理断开连接事件 - 清理用户订阅
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.info("WebSocket 断开连接: sessionId={}", sessionId);

        // 找到断开连接的用户并清理订阅
        Long disconnectedUserId = null;
        for (Map.Entry<Long, String> entry : activeConnections.entrySet()) {
            if (entry.getValue().equals(sessionId)) {
                disconnectedUserId = entry.getKey();
                break;
            }
        }

        if (disconnectedUserId != null) {
            activeConnections.remove(disconnectedUserId);
            // 清理用户的订阅
            stockSubscriptionService.onUserDisconnect(disconnectedUserId);
            log.info("已清理用户 {} 的订阅", disconnectedUserId);
        }
    }

    /**
     * 处理订阅事件
     */
    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        log.info("WebSocket 订阅事件: {}", event.getMessage().getHeaders());
    }

    /**
     * 从头部获取用户 Principal
     */
    private WebSocketChannelInterceptor.WebSocketUserPrincipal getUserPrincipal(SimpMessageHeaderAccessor headerAccessor) {
        if (headerAccessor.getUser() instanceof WebSocketChannelInterceptor.WebSocketUserPrincipal) {
            return (WebSocketChannelInterceptor.WebSocketUserPrincipal) headerAccessor.getUser();
        }
        return null;
    }

    /**
     * 获取活跃连接数
     */
    public int getActiveConnectionCount() {
        return activeConnections.size();
    }
}
