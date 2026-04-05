package com.koduck.portfolio.dto;

import java.math.BigDecimal;

/**
 * 投资组合汇总数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param totalCost        总成本
 * @param totalMarketValue 总市值
 * @param totalPnl         总盈亏
 * @param totalPnlPercent  总盈亏百分比
 * @param dailyPnl         当日盈亏
 * @param dailyPnlPercent  当日盈亏百分比
 * @author Koduck Team
 */
public record PortfolioSummaryDto(
        BigDecimal totalCost,
        BigDecimal totalMarketValue,
        BigDecimal totalPnl,
        BigDecimal totalPnlPercent,
        BigDecimal dailyPnl,
        BigDecimal dailyPnlPercent
) {
}
