package com.koduck.config;

import com.koduck.config.properties.WebSocketProperties;
import com.koduck.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket 
 *
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
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketProperties webSocketProperties;
    private final JwtUtil jwtUtil;
    private final JwtConfig jwtConfig;

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
        registration.interceptors(new WebSocketChannelInterceptor(jwtUtil, jwtConfig));
    }

    /**
     *  STOMP 
     *
     * @param registry STOMP 
     */
    @Override
    public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
        registry.addEndpoint(webSocketProperties.getEndpoint())
                // 
                .setAllowedOriginPatterns("*")
                //  SockJS fallback
                .withSockJS();
    }
}
