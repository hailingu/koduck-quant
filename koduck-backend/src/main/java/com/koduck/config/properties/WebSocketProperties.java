package com.koduck.config.properties;

import com.koduck.util.CollectionCopyUtils;
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

        public Broker() {
        }

        public Broker(Broker broker) {
            if (broker != null) {
                this.topicPrefix = broker.topicPrefix;
                this.queuePrefix = broker.queuePrefix;
            }
        }
    }

    public String[] getAllowedOrigins() {
        return CollectionCopyUtils.copyArray(allowedOrigins);
    }

    public void setAllowedOrigins(String[] allowedOrigins) {
        this.allowedOrigins = CollectionCopyUtils.copyArray(allowedOrigins);
    }

    public Broker getBroker() {
        return broker == null ? null : new Broker(broker);
    }

    public void setBroker(Broker broker) {
        this.broker = broker == null ? null : new Broker(broker);
    }
}
