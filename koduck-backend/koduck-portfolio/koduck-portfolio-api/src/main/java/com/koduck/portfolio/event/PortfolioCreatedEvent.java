package com.koduck.portfolio.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

/**
 * 投资组合创建事件。
 *
 * <p>当新的投资组合被创建时发布。订阅者可以监听此事件执行后续操作，如：</p>
 * <ul>
 *   <li>发送通知</li>
 *   <li>自动分析</li>
 *   <li>记录审计日志</li>
 * </ul>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class PortfolioCreatedEvent extends DomainEvent {

    /** 投资组合ID。 */
    private final Long portfolioId;

    /** 投资组合名称。 */
    private final String portfolioName;

    /** 用户ID。 */
    private final Long userId;

    /**
     * 构造投资组合创建事件。
     *
     * @param portfolioId 投资组合ID
     * @param portfolioName 投资组合名称
     * @param userId 用户ID
     */
    public PortfolioCreatedEvent(Long portfolioId, String portfolioName, Long userId) {
        super();
        this.portfolioId = portfolioId;
        this.portfolioName = portfolioName;
        this.userId = userId;
    }

    @Override
    public String toString() {
        return String.format("PortfolioCreatedEvent[portfolioId=%d, portfolioName=%s, userId=%d, %s]",
            portfolioId, portfolioName, userId, super.toString());
    }
}
