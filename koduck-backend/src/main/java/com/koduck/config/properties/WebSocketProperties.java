package com.koduck.config.properties;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * WebSocket 
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "koduck.websocket")
public class WebSocketProperties {

    /**
     * WebSocket 
     */
    private String endpoint = "/ws";

    /**
     * 
     */
    private String applicationDestinationPrefix = "/app";

    /**
     * （ CORS）
     */
    private String[] allowedOrigins = {"*"};

    /**
     * （）
     */
    private int heartbeatInterval = 25;

    /**
     * 
     */
    private Broker broker = new Broker();

    @Getter
    @Setter
    public static class Broker {
        /**
         * （）
         */
        private String topicPrefix = "/topic";

        /**
         * （）
         */
        private String queuePrefix = "/queue";
    }
}
