package com.koduck.strategy.dto;

import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 回测摘要信息。
 *
 * <p>用于列表展示，不包含详细的交易记录。</p>
 *
 * @param id 回测ID
 * @param strategyId 策略ID
 * @param symbol 股票代码
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @param totalReturn 总收益率
 * @param maxDrawdown 最大回撤
 * @param sharpeRatio 夏普比率
 * @param totalTrades 总交易次数
 * @param status 回测状态
 * @param createdAt 创建时间
 */
@Value
@Builder
public class BacktestSummaryDto implements Serializable {
    private static final long serialVersionUID = 1L;

    Long id;
    Long strategyId;
    String symbol;
    LocalDate startDate;
    LocalDate endDate;
    BigDecimal totalReturn;
    BigDecimal maxDrawdown;
    BigDecimal sharpeRatio;
    Integer totalTrades;
    String status;
    Instant createdAt;
}
