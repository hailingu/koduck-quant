package com.koduck.config.properties;

import com.koduck.util.CollectionCopyUtils;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Properties for WebSocket messaging configuration.
 * <p>
 * This class binds the prefix {@code koduck.websocket} and provides defensive copies
 * for nested mutable structures.
 * </p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "koduck.websocket")
public class WebSocketProperties {

    /**
     * WebSocket endpoint path.
     */
    private String endpoint = "/ws";

    /**
     * Prefix for application destination mappings.
     */
    private String applicationDestinationPrefix = "/app";

    /**
     * CORS allowed origins for WebSocket handshake.
     */
    private String[] allowedOrigins = {"*"};

    /**
     * Heartbeat interval in seconds.
     */
    private int heartbeatInterval = 25;

    /**
     * Broker settings for destination prefix mapping.
     */
    private Broker broker = new Broker();

    @Getter
    @Setter
    public static class Broker {
        /**
         * Topic prefix for broker destinations.
         */
        private String topicPrefix = "/topic";

        /**
         * Queue prefix for broker destinations.
         */
        private String queuePrefix = "/queue";

        public Broker() {
            // no-op
        }

        public Broker(Broker broker) {
            if (broker != null) {
                this.topicPrefix = broker.topicPrefix;
                this.queuePrefix = broker.queuePrefix;
            }
        }
    }

    /**
     * Returns a defensive copy of allowed origins.
     *
     * @return array of allowed origins
     */
    public String[] getAllowedOrigins() {
        return CollectionCopyUtils.copyArray(allowedOrigins);
    }

    /**
     * Sets allowed origins with defensive copy.
     *
     * @param allowedOrigins allowed origins array
     */
    public void setAllowedOrigins(String[] allowedOrigins) {
        this.allowedOrigins = CollectionCopyUtils.copyArray(allowedOrigins);
    }

    /**
     * Returns a defensive copy of broker settings.
     *
     * @return broker settings instance
     */
    public Broker getBroker() {
        return broker == null ? null : new Broker(broker);
    }

    /**
     * Sets broker settings using defensive copy.
     *
     * @param broker broker settings instance
     */
    public void setBroker(Broker broker) {
        this.broker = broker == null ? null : new Broker(broker);
    }
}
