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

import com.koduck.config.properties.WebSocketProperties;
import com.koduck.security.websocket.WebSocketChannelInterceptor;

/**
 * WebSocket 
 * <p> STOMP  WebSocket Broker，：</p>
 * <ul>
 *   <li>（/topic  /queue）</li>
 *   <li>（/app）</li>
 *   <li>SockJS fallback </li>
 *   <li>CORS </li>
 * </ul>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final WebSocketProperties webSocketProperties;
    private final WebSocketChannelInterceptor webSocketChannelInterceptor;

    public WebSocketConfig(WebSocketProperties webSocketProperties,
                           WebSocketChannelInterceptor webSocketChannelInterceptor) {
        this.webSocketProperties = Objects.requireNonNull(webSocketProperties, "webSocketProperties must not be null");
        this.webSocketChannelInterceptor = Objects.requireNonNull(webSocketChannelInterceptor,
                "webSocketChannelInterceptor must not be null");
    }
    /**
     * 
     *
     * @param config 
     */
    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry config) {
        // 
        // /topic - （）
        // /queue - （）
        config.enableSimpleBroker(
                webSocketProperties.getBroker().getTopicPrefix(),
                webSocketProperties.getBroker().getQueuePrefix()
        );
        //  -  /app/*  @MessageMapping 
        config.setApplicationDestinationPrefixes(webSocketProperties.getApplicationDestinationPrefix());
    }
    @Override
    public void configureClientInboundChannel(@NonNull ChannelRegistration registration) {
        registration.interceptors(webSocketChannelInterceptor);
    }
    /**
     *  STOMP 
     *
     * @param registry STOMP 
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
                //  SockJS fallback
                .withSockJS();
    }
}
