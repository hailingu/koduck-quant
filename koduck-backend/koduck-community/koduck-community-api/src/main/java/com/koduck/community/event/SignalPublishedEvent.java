package com.koduck.community.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.Instant;

/**
 * 信号发布事件。
 *
 * <p>当新信号被发布时发布。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class SignalPublishedEvent extends ApplicationEvent {

    private static final long serialVersionUID = 1L;

    private final Long signalId;
    private final Long userId;
    private final String signalTitle;
    private final String symbol;
    private final String direction;
    private final Instant occurredOn;

    /**
     * 创建信号发布事件。
     *
     * @param source 事件源
     * @param signalId 信号ID
     * @param userId 用户ID
     * @param signalTitle 信号标题
     * @param symbol 股票代码
     * @param direction 交易方向
     */
    public SignalPublishedEvent(Object source, Long signalId, Long userId,
                                String signalTitle, String symbol, String direction) {
        super(source);
        this.signalId = signalId;
        this.userId = userId;
        this.signalTitle = signalTitle;
        this.symbol = symbol;
        this.direction = direction;
        this.occurredOn = Instant.now();
    }
}
