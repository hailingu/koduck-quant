package com.koduck.messaging;

import com.koduck.config.properties.PricePushRabbitProperties;
import com.koduck.dto.market.RealtimePriceEventMessage;
import com.koduck.service.PricePushService;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Consumes realtime quote events from RabbitMQ and forwards to price push service.
 */
@Component
@Slf4j
@ConditionalOnProperty(prefix = "koduck.messaging.price-push", name = "enabled", havingValue = "true")
public class PricePushRabbitListener {

    private final PricePushService pricePushService;

    public PricePushRabbitListener(PricePushService pricePushService,
                                   PricePushRabbitProperties properties) {
        this.pricePushService = Objects.requireNonNull(pricePushService, "pricePushService must not be null");
        Objects.requireNonNull(properties, "properties must not be null");
    }

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
