package com.koduck.messaging;

import java.util.Objects;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.koduck.config.properties.PricePushRabbitProperties;
import com.koduck.dto.market.RealtimePriceEventMessage;
import com.koduck.service.PricePushService;

import lombok.extern.slf4j.Slf4j;

/**
 * Consumes realtime quote events from RabbitMQ and forwards to price push service.
 *
 * @author Koduck Team
 */
@Component
@Slf4j
@ConditionalOnProperty(prefix = "koduck.messaging.price-push", name = "enabled", havingValue = "true")
public class PricePushRabbitListener {

    /** The price push service. */
    private final PricePushService pricePushService;

    /**
     * Constructor.
     *
     * @param pricePushService the price push service
     * @param properties the rabbit properties
     */
    public PricePushRabbitListener(PricePushService pricePushService,
                                   PricePushRabbitProperties properties) {
        this.pricePushService = Objects.requireNonNull(pricePushService, "pricePushService must not be null");
        Objects.requireNonNull(properties, "properties must not be null");
    }

    /**
     * Handle realtime price event from RabbitMQ.
     *
     * @param message the realtime price event message
     */
    @RabbitListener(
            queues = "#{@pricePushRabbitProperties.queue}",
            containerFactory = "pricePushRabbitListenerContainerFactory"
    )
    public void onRealtimePriceEvent(RealtimePriceEventMessage message) {
        if (message == null || message.getSymbol() == null || message.getSymbol().isBlank()) {
            log.warn("Skip invalid realtime event from RabbitMQ: {}", message);
            return;
        }
        pricePushService.onRealtimePriceEvent(message);
    }
}
