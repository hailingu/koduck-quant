package com.koduck.config;

import java.util.Map;
import java.util.Objects;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.infrastructure.config.properties.PricePushRabbitProperties;

/**
 * 价格推送事件的 RabbitMQ 拓扑和监听器配置。
 *
 * @author Koduck Team
 */
@Configuration
@EnableRabbit
@ConditionalOnProperty(prefix = "koduck.messaging.price-push", name = "enabled", havingValue = "true")
public class RabbitPricePushConfig {

    @Bean
    public DirectExchange pricePushExchange(PricePushRabbitProperties properties) {
        return new DirectExchange(properties.getExchange(), true, false);
    }

    @Bean
    public DirectExchange pricePushDeadLetterExchange(PricePushRabbitProperties properties) {
        return new DirectExchange(properties.getDeadLetterExchange(), true, false);
    }

    @Bean
    public Queue pricePushQueue(PricePushRabbitProperties properties) {
        return new Queue(
            properties.getQueue(),
            true,
            false,
            false,
            Map.of(
                "x-dead-letter-exchange", properties.getDeadLetterExchange(),
                "x-dead-letter-routing-key", properties.getDeadLetterRoutingKey()
            )
        );
    }

    @Bean
    public Queue pricePushDeadLetterQueue(PricePushRabbitProperties properties) {
        return new Queue(properties.getDeadLetterQueue(), true);
    }

    @Bean
    public Binding pricePushBinding(@Qualifier("pricePushQueue") Queue pricePushQueue,
                                    DirectExchange pricePushExchange,
                                    PricePushRabbitProperties properties) {
        return BindingBuilder.bind(pricePushQueue)
            .to(pricePushExchange)
            .with(properties.getRoutingKey());
    }

    @Bean
    public Binding pricePushDeadLetterBinding(@Qualifier("pricePushDeadLetterQueue") Queue pricePushDeadLetterQueue,
                                              DirectExchange pricePushDeadLetterExchange,
                                              PricePushRabbitProperties properties) {
        return BindingBuilder.bind(pricePushDeadLetterQueue)
            .to(pricePushDeadLetterExchange)
            .with(properties.getDeadLetterRoutingKey());
    }

    @Bean
    public MessageConverter rabbitMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(Objects.requireNonNull(objectMapper, "objectMapper must not be null"));
    }

    @Bean(name = "pricePushRabbitListenerContainerFactory")
    public SimpleRabbitListenerContainerFactory pricePushRabbitListenerContainerFactory(
        ConnectionFactory connectionFactory,
        MessageConverter rabbitMessageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(rabbitMessageConverter);
        factory.setDefaultRequeueRejected(false);
        return factory;
    }
}
