package com.koduck.portfolio.event;

import java.time.Instant;
import java.util.UUID;

/**
 * 投资组合创建领域事件。
 *
 * @param eventId     事件唯一标识
 * @param timestamp   事件发生时间
 * @param userId      用户ID
 * @param portfolioId 投资组合ID
 * @author Koduck Team
 */
public record PortfolioCreatedEvent(
        String eventId,
        Instant timestamp,
        Long userId,
        Long portfolioId
) {

    /**
     * 创建新的事件实例，自动生成事件ID和时间戳。
     *
     * @param userId      用户ID
     * @param portfolioId 投资组合ID
     */
    public PortfolioCreatedEvent(Long userId, Long portfolioId) {
        this(
                UUID.randomUUID().toString(),
                Instant.now(),
                userId,
                portfolioId
        );
    }
}
