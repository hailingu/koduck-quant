package com.koduck.strategy.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.Instant;

/**
 * 策略创建事件。
 *
 * <p>当新策略被创建时发布。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class StrategyCreatedEvent extends ApplicationEvent {

    private static final long serialVersionUID = 1L;

    private final Long strategyId;
    private final Long userId;
    private final String strategyName;
    private final String strategyType;
    private final Instant occurredOn;

    /**
     * 创建策略创建事件。
     *
     * @param source 事件源
     * @param strategyId 策略ID
     * @param userId 用户ID
     * @param strategyName 策略名称
     * @param strategyType 策略类型
     */
    public StrategyCreatedEvent(Object source, Long strategyId, Long userId,
                                String strategyName, String strategyType) {
        super(source);
        this.strategyId = strategyId;
        this.userId = userId;
        this.strategyName = strategyName;
        this.strategyType = strategyType;
        this.occurredOn = Instant.now();
    }
}
