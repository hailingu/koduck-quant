package com.koduck.community.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

/**
 * 信号发布事件。
 *
 * <p>当用户发布新的交易信号时发布。订阅者可以监听此事件执行后续操作，如：</p>
 * <ul>
 *   <li>AI 自动分析</li>
 *   <li>发送通知给订阅者</li>
 *   <li>更新热门信号排行</li>
 * </ul>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class SignalPublishedEvent extends DomainEvent {

    /** 信号ID。 */
    private final Long signalId;

    /** 股票代码。 */
    private final String symbol;

    /** 信号类型：BUY, SELL。 */
    private final String signalType;

    /** 发布者ID。 */
    private final Long publisherId;

    /**
     * 构造信号发布事件。
     *
     * @param signalId 信号ID
     * @param symbol 股票代码
     * @param signalType 信号类型
     * @param publisherId 发布者ID
     */
    public SignalPublishedEvent(Long signalId, String symbol,
                                 String signalType, Long publisherId) {
        super();
        this.signalId = signalId;
        this.symbol = symbol;
        this.signalType = signalType;
        this.publisherId = publisherId;
    }

    @Override
    public String toString() {
        return String.format("SignalPublishedEvent[signalId=%d, symbol=%s, type=%s, %s]",
            signalId, symbol, signalType, super.toString());
    }
}
