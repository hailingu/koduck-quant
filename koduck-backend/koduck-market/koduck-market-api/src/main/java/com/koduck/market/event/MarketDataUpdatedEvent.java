package com.koduck.market.event;

import java.time.Instant;
import java.util.List;

/**
 * 行情数据更新领域事件。
 *
 * <p>当股票行情数据发生变化时发布此事件。</p>
 *
 * <p>其他领域模块可以订阅此事件以获取实时行情更新。</p>
 *
 * @param eventId   事件唯一标识
 * @param timestamp 事件发生时间
 * @param symbols   更新的股票代码列表
 * @param source    数据来源
 * @author Koduck Team
 */
public record MarketDataUpdatedEvent(
        String eventId,
        Instant timestamp,
        List<String> symbols,
        String source
) {

    /**
     * 创建新的事件实例，自动生成事件ID和时间戳。
     *
     * @param symbols 更新的股票代码列表
     * @param source  数据来源
     */
    public MarketDataUpdatedEvent(List<String> symbols, String source) {
        this(
                java.util.UUID.randomUUID().toString(),
                Instant.now(),
                symbols,
                source
        );
    }
}
