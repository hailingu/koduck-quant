package com.koduck.portfolio.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 持仓数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param id           持仓ID
 * @param market       市场代码
 * @param symbol       股票代码
 * @param name         股票名称
 * @param quantity     持仓数量
 * @param avgCost      平均成本
 * @param currentPrice 当前价格
 * @param marketValue  市值
 * @param pnl          盈亏
 * @param pnlPercent   盈亏百分比
 * @param createdAt    创建时间
 * @param updatedAt    更新时间
 * @author Koduck Team
 */
public record PortfolioPositionDto(
        Long id,
        String market,
        String symbol,
        String name,
        BigDecimal quantity,
        BigDecimal avgCost,
        BigDecimal currentPrice,
        BigDecimal marketValue,
        BigDecimal pnl,
        BigDecimal pnlPercent,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
