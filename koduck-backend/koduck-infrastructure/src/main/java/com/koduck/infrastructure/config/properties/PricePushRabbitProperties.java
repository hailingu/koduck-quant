package com.koduck.infrastructure.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ configuration for realtime price push pipeline.
 *
 * @author Koduck Team
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.messaging.price-push")
public class PricePushRabbitProperties {

    /** Whether the price push pipeline is enabled. */
    private boolean enabled = true;

    /** Exchange name for price messages. */
    private String exchange = "koduck.price.exchange";

    /** Queue name for realtime price messages. */
    private String queue = "koduck.price.realtime.queue";

    /** Routing key for price messages. */
    private String routingKey = "stock.realtime";

    /** Dead letter exchange name. */
    private String deadLetterExchange = "koduck.price.dlx";

    /** Dead letter queue name. */
    private String deadLetterQueue = "koduck.price.realtime.dlq";

    /** Dead letter routing key. */
    private String deadLetterRoutingKey = "stock.realtime.dlq";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getQueue() {
        return queue;
    }

    public void setQueue(String queue) {
        this.queue = queue;
    }

    public String getRoutingKey() {
        return routingKey;
    }

    public void setRoutingKey(String routingKey) {
        this.routingKey = routingKey;
    }

    public String getDeadLetterExchange() {
        return deadLetterExchange;
    }

    public void setDeadLetterExchange(String deadLetterExchange) {
        this.deadLetterExchange = deadLetterExchange;
    }

    public String getDeadLetterQueue() {
        return deadLetterQueue;
    }

    public void setDeadLetterQueue(String deadLetterQueue) {
        this.deadLetterQueue = deadLetterQueue;
    }

    public String getDeadLetterRoutingKey() {
        return deadLetterRoutingKey;
    }

    public void setDeadLetterRoutingKey(String deadLetterRoutingKey) {
        this.deadLetterRoutingKey = deadLetterRoutingKey;
    }
}
