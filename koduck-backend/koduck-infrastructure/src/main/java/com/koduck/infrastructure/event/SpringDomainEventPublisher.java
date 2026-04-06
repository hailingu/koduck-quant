package com.koduck.infrastructure.event;

import com.koduck.common.event.DomainEvent;
import com.koduck.common.event.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Spring 领域事件发布器实现。
 *
 * <p>基于 Spring 的 {@link ApplicationEventPublisher} 实现事件发布。
 * 支持同步和异步事件处理。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SpringDomainEventPublisher implements DomainEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;

    @Override
    public void publish(DomainEvent event) {
        if (event == null) {
            throw new IllegalArgumentException("Domain event must not be null");
        }

        log.debug("Publishing domain event: type={}, id={}",
            event.getEventType(), event.getEventId());

        applicationEventPublisher.publishEvent(event);

        log.debug("Domain event published successfully: type={}, id={}",
            event.getEventType(), event.getEventId());
    }
}
