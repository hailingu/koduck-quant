package com.koduck.market.dto;

import java.math.BigDecimal;

/**
 * 市场指数数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param symbol        指数代码
 * @param name          指数名称
 * @param price         当前点数
 * @param change        涨跌点
 * @param changePercent 涨跌幅百分比
 * @author Koduck Team
 */
public record MarketIndexDto(
        String symbol,
        String name,
        BigDecimal price,
        BigDecimal change,
        BigDecimal changePercent
) {
}
