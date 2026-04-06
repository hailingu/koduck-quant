package com.koduck.portfolio.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * 持仓变更事件。
 *
 * <p>当投资组合的持仓发生变化时发布，包括：</p>
 * <ul>
 *   <li>新增持仓</li>
 *   <li>减持持仓</li>
 *   <li>清仓</li>
 * </ul>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class PositionChangedEvent extends DomainEvent {

    /** 投资组合ID。 */
    private final Long portfolioId;

    /** 股票代码。 */
    private final String symbol;

    /** 变更类型：BUY, SELL, CLOSE。 */
    private final String changeType;

    /** 变更数量。 */
    private final BigDecimal quantity;

    /** 变更金额。 */
    private final BigDecimal amount;

    /**
     * 构造持仓变更事件。
     *
     * @param portfolioId 投资组合ID
     * @param symbol 股票代码
     * @param changeType 变更类型
     * @param quantity 变更数量
     * @param amount 变更金额
     */
    public PositionChangedEvent(Long portfolioId, String symbol, String changeType,
                                 BigDecimal quantity, BigDecimal amount) {
        super();
        this.portfolioId = portfolioId;
        this.symbol = symbol;
        this.changeType = changeType;
        this.quantity = quantity;
        this.amount = amount;
    }

    @Override
    public String toString() {
        return String.format("PositionChangedEvent[portfolioId=%d, symbol=%s, type=%s, %s]",
            portfolioId, symbol, changeType, super.toString());
    }
}
