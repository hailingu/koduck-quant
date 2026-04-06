package com.koduck.strategy.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 回测完成事件。
 *
 * <p>当回测执行完成时发布。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class BacktestCompletedEvent extends ApplicationEvent {

    private static final long serialVersionUID = 1L;

    private final Long backtestId;
    private final Long strategyId;
    private final Long userId;
    private final String symbol;
    private final BigDecimal totalReturn;
    private final BigDecimal sharpeRatio;
    private final Integer totalTrades;
    private final String status;
    private final Instant occurredOn;

    /**
     * 创建回测完成事件。
     *
     * @param source 事件源
     * @param backtestId 回测ID
     * @param strategyId 策略ID
     * @param userId 用户ID
     * @param symbol 股票代码
     * @param totalReturn 总收益率
     * @param sharpeRatio 夏普比率
     * @param totalTrades 总交易次数
     * @param status 回测状态
     */
    public BacktestCompletedEvent(Object source, Long backtestId, Long strategyId,
                                  Long userId, String symbol, BigDecimal totalReturn,
                                  BigDecimal sharpeRatio, Integer totalTrades,
                                  String status) {
        super(source);
        this.backtestId = backtestId;
        this.strategyId = strategyId;
        this.userId = userId;
        this.symbol = symbol;
        this.totalReturn = totalReturn;
        this.sharpeRatio = sharpeRatio;
        this.totalTrades = totalTrades;
        this.status = status;
        this.occurredOn = Instant.now();
    }
}
