package com.koduck.controller;

import com.koduck.config.WebSocketChannelInterceptor;
import com.koduck.dto.websocket.WebSocketMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.Map;
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

    /**
     * 存储活跃连接的用户
     * userId -> sessionId
     */
    private final Map<Long, String> activeConnections = new ConcurrentHashMap<>();

    /**
     * 处理订阅请求
     *
     * @param destination 订阅目标（如股票代码）
     * @param headerAccessor 消息头部访问器
     * @return 订阅结果
     */
    @MessageMapping("/subscribe")
    @SendToUser("/queue/subscribe-result")
    public WebSocketMessage handleSubscribe(@DestinationVariable String destination,
                                            SimpMessageHeaderAccessor headerAccessor) {
        log.info("用户订阅: destination={}, sessionId={}", destination, headerAccessor.getSessionId());

        // 获取用户信息
        WebSocketChannelInterceptor.WebSocketUserPrincipal principal = getUserPrincipal(headerAccessor);
        if (principal != null) {
            activeConnections.put(principal.getUserId(), headerAccessor.getSessionId());
        }

        return WebSocketMessage.success("subscribe", destination,
                Map.of("status", "subscribed", "destination", destination));
    }

    /**
     * 处理取消订阅请求
     *
     * @param destination 取消订阅目标
     * @param headerAccessor 消息头部访问器
     * @return 取消订阅结果
     */
    @MessageMapping("/unsubscribe")
    @SendToUser("/queue/unsubscribe-result")
    public WebSocketMessage handleUnsubscribe(@DestinationVariable String destination,
                                               SimpMessageHeaderAccessor headerAccessor) {
        log.info("用户取消订阅: destination={}, sessionId={}", destination, headerAccessor.getSessionId());

        // 获取用户信息
        WebSocketChannelInterceptor.WebSocketUserPrincipal principal = getUserPrincipal(headerAccessor);
        if (principal != null) {
            activeConnections.remove(principal.getUserId());
        }

        return WebSocketMessage.success("unsubscribe", destination,
                Map.of("status", "unsubscribed", "destination", destination));
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
     * 处理断开连接事件
     */
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.info("WebSocket 断开连接: sessionId={}", sessionId);

        // 移除断开连接的用户的活跃连接记录
        activeConnections.entrySet().removeIf(entry -> entry.getValue().equals(sessionId));
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
