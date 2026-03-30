package com.koduck.config;

import com.koduck.config.properties.WebSocketProperties;
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
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private WebSocketProperties webSocketProperties;

    private WebSocketChannelInterceptor webSocketChannelInterceptor;

    /**
     * Injects the WebSocket dependencies.
     *
     * @param webSocketProperties WebSocket configuration properties
     * @param webSocketChannelInterceptor inbound channel interceptor
     */
    @org.springframework.beans.factory.annotation.Autowired
    public void setDependencies(
            WebSocketProperties webSocketProperties,
            WebSocketChannelInterceptor webSocketChannelInterceptor) {
        this.webSocketProperties = webSocketProperties;
        this.webSocketChannelInterceptor = webSocketChannelInterceptor;
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
        registry.addEndpoint(webSocketProperties.getEndpoint())
                // 
                .setAllowedOriginPatterns("*")
                //  SockJS fallback
                .withSockJS();
    }
}
