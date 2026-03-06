package com.koduck.config;

import com.koduck.config.properties.WebSocketProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket 配置类
 *
 * <p>配置 STOMP 协议的 WebSocket 消息Broker，支持以下功能：</p>
 * <ul>
 *   <li>简单的内存消息代理（/topic 和 /queue）</li>
 *   <li>应用目标前缀（/app）用于接收客户端消息</li>
 *   <li>SockJS fallback 支持</li>
 *   <li>CORS 配置</li>
 * </ul>
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketProperties webSocketProperties;

    /**
     * 配置消息代理
     *
     * @param config 消息代理注册表
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 启用简单的内存消息代理
        // /topic - 广播主题（多人订阅）
        // /queue - 私有队列（单用户接收）
        config.enableSimpleBroker(
                webSocketProperties.getBroker().getTopicPrefix(),
                webSocketProperties.getBroker().getQueuePrefix()
        );
        // 应用目标前缀 - 客户端发送到 /app/* 的消息将路由到 @MessageMapping 方法
        config.setApplicationDestinationPrefixes(webSocketProperties.getApplicationDestinationPrefix());
    }

    /**
     * 注册 STOMP 端点
     *
     * @param registry STOMP 端点注册表
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(webSocketProperties.getEndpoint())
                // 允许所有来源跨域
                .setAllowedOriginPatterns("*")
                // 启用 SockJS fallback
                .withSockJS();
    }
}
