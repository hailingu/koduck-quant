package com.koduck.config;

import java.util.Arrays;
import java.util.Objects;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.koduck.config.properties.StompRelayProperties;
import com.koduck.config.properties.WebSocketProperties;
import com.koduck.security.websocket.WebSocketChannelInterceptor;

/**
 * WebSocket 配置类
 * <p>配置 STOMP 协议的 WebSocket 消息代理，支持两种模式：</p>
 * <ul>
 *   <li><b>简单模式</b>（开发环境）：使用内存 Broker（SimpleBroker）</li>
 *   <li><b>中继模式</b>（生产环境）：使用外部 STOMP Broker（RabbitMQ）</li>
 * </ul>
 * <p>功能包括：</p>
 * <ul>
 *   <li>消息代理前缀配置（/topic 用于广播，/queue 用于点对点）</li>
 *   <li>应用目的地前缀（/app）</li>
 *   <li>SockJS fallback 支持</li>
 *   <li>CORS 跨域配置</li>
 * </ul>
 *
 * @author Koduck Team
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * WebSocket properties.
     */
    private final WebSocketProperties webSocketProperties;

    /**
     * STOMP relay properties.
     */
    private final StompRelayProperties stompRelayProperties;

    /**
     * WebSocket channel interceptor.
     */
    private final WebSocketChannelInterceptor webSocketChannelInterceptor;

    /**
     * Constructor with required dependencies.
     *
     * @param webSocketProperties         WebSocket properties
     * @param stompRelayProperties        STOMP relay properties
     * @param webSocketChannelInterceptor WebSocket channel interceptor
     */
    public WebSocketConfig(WebSocketProperties webSocketProperties,
                           StompRelayProperties stompRelayProperties,
                           WebSocketChannelInterceptor webSocketChannelInterceptor) {
        this.webSocketProperties = Objects.requireNonNull(webSocketProperties, "webSocketProperties must not be null");
        this.stompRelayProperties = Objects.requireNonNull(stompRelayProperties,
            "stompRelayProperties must not be null");
        this.webSocketChannelInterceptor = Objects.requireNonNull(webSocketChannelInterceptor,
            "webSocketChannelInterceptor must not be null");
    }

    /**
     * 配置消息代理
     * <p>根据配置选择使用外部 STOMP Broker 或内存 SimpleBroker：</p>
     * <ul>
     *   <li>STOMP Relay 模式（stomp-relay.enabled=true）：使用 RabbitMQ 等外部 Broker，支持横向扩展</li>
     *   <li>Simple Broker 模式（默认）：使用内存 Broker，适用于开发和单实例部署</li>
     * </ul>
     *
     * @param config MessageBrokerRegistry
     */
    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry config) {
        if (stompRelayProperties.isEnabled()) {
            // 生产环境：使用外部 STOMP Broker（RabbitMQ），支持多实例共享订阅状态
            configureStompBrokerRelay(config);
        }
        else {
            // 开发环境：使用内存 SimpleBroker
            configureSimpleBroker(config);
        }

        // 配置应用目的地前缀 - 发往 /app/* 的消息会被 @MessageMapping 处理
        config.setApplicationDestinationPrefixes(webSocketProperties.getApplicationDestinationPrefix());
    }

    /**
     * 配置 STOMP Broker Relay（外部消息代理）
     * <p>适用于生产环境，支持：</p>
     * <ul>
     *   <li>多实例订阅状态共享</li>
     *   <li>横向扩展</li>
     *   <li>消息持久化</li>
     * </ul>
     *
     * @param config MessageBrokerRegistry
     */
    private void configureStompBrokerRelay(MessageBrokerRegistry config) {
        config.enableStompBrokerRelay(
                webSocketProperties.getBroker().getTopicPrefix(),
                webSocketProperties.getBroker().getQueuePrefix()
            )
            .setRelayHost(stompRelayProperties.getHost())
            .setRelayPort(stompRelayProperties.getPort())
            .setClientLogin(stompRelayProperties.getUsername())
            .setClientPasscode(stompRelayProperties.getPassword())
            .setSystemLogin(stompRelayProperties.getSystemLogin())
            .setSystemPasscode(stompRelayProperties.getSystemPasscode())
            .setSystemHeartbeatSendInterval(stompRelayProperties.getSystemHeartbeatSendInterval())
            .setSystemHeartbeatReceiveInterval(stompRelayProperties.getSystemHeartbeatReceiveInterval());
    }

    /**
     * 配置 Simple Broker（内存消息代理）
     * <p>适用于开发环境，特点是：</p>
     * <ul>
     *   <li>零外部依赖</li>
     *   <li>单实例使用</li>
     *   <li>内存存储，重启丢失</li>
     * </ul>
     *
     * @param config MessageBrokerRegistry
     */
    private void configureSimpleBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker(
            webSocketProperties.getBroker().getTopicPrefix(),
            webSocketProperties.getBroker().getQueuePrefix()
        );
    }

    @Override
    public void configureClientInboundChannel(@NonNull ChannelRegistration registration) {
        registration.interceptors(webSocketChannelInterceptor);
    }

    /**
     * 注册 STOMP 端点
     * <p>配置 SockJS 回退选项和 CORS 允许的源</p>
     *
     * @param registry STOMP 端点注册器
     */
    @Override
    public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
        String[] allowedOrigins = Arrays.stream(webSocketProperties.getAllowedOrigins())
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .filter(origin -> !"*".equals(origin))
            .toArray(String[]::new);
        if (allowedOrigins.length == 0) {
            throw new IllegalStateException("WebSocket allowed-origins must not be empty or wildcard");
        }

        registry.addEndpoint(webSocketProperties.getEndpoint())
            .setAllowedOrigins(allowedOrigins)
            // 启用 SockJS fallback 选项
            .withSockJS();
    }
}
