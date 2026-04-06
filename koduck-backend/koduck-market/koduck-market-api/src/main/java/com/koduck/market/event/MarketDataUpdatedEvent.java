package com.koduck.market.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * 行情数据更新事件。
 *
 * <p>当股票行情数据发生变化时发布。订阅者可以监听此事件执行后续操作，如：</p>
 * <ul>
 *   <li>更新投资组合市值</li>
 *   <li>触发价格预警</li>
 *   <li>更新缓存</li>
 * </ul>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class MarketDataUpdatedEvent extends DomainEvent {

    /** 股票代码。 */
    private final String symbol;

    /** 当前价格。 */
    private final BigDecimal currentPrice;

    /** 涨跌幅（百分比）。 */
    private final BigDecimal changePercent;

    /** 市场代码。 */
    private final String market;

    /**
     * 构造行情数据更新事件。
     *
     * @param symbol 股票代码
     * @param currentPrice 当前价格
     * @param changePercent 涨跌幅
     * @param market 市场代码
     */
    public MarketDataUpdatedEvent(String symbol, BigDecimal currentPrice,
                                   BigDecimal changePercent, String market) {
        super();
        this.symbol = symbol;
        this.currentPrice = currentPrice;
        this.changePercent = changePercent;
        this.market = market;
    }

    @Override
    public String toString() {
        return String.format("MarketDataUpdatedEvent[symbol=%s, price=%s, change=%s%%, %s]",
            symbol, currentPrice, changePercent, super.toString());
    }
}
