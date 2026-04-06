package com.koduck.common.event;

import java.time.Instant;
import java.util.UUID;

/**
 * 领域事件基类。
 *
 * <p>所有领域事件必须继承此类。领域事件用于模块间解耦通信，
 * 采用发布-订阅模式。</p>
 *
 * <p>特性：</p>
 * <ul>
 *   <li>自动生成唯一事件ID</li>
 *   <li>自动记录发生时间</li>
 *   <li>自动识别事件类型</li>
 * </ul>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public abstract class DomainEvent {

    /** 事件唯一标识。 */
    private final String eventId;

    /** 事件发生时间。 */
    private final Instant occurredOn;

    /** 事件类型（类名）。 */
    private final String eventType;

    /**
     * 构造领域事件。
     *
     * <p>自动生成事件ID、发生时间和事件类型。</p>
     */
    protected DomainEvent() {
        this.eventId = UUID.randomUUID().toString();
        this.occurredOn = Instant.now();
        this.eventType = this.getClass().getSimpleName();
    }

    /**
     * 获取事件ID。
     *
     * @return 事件唯一标识
     */
    public String getEventId() {
        return eventId;
    }

    /**
     * 获取事件发生时间。
     *
     * @return 发生时间
     */
    public Instant getOccurredOn() {
        return occurredOn;
    }

    /**
     * 获取事件类型。
     *
     * @return 事件类型（类名）
     */
    public String getEventType() {
        return eventType;
    }

    @Override
    public String toString() {
        return String.format("%s[eventId=%s, occurredOn=%s]",
            eventType, eventId, occurredOn);
    }
}
