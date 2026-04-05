package com.koduck.market.dto;

import java.math.BigDecimal;

/**
 * 股票代码信息数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param symbol        股票代码
 * @param name          股票名称
 * @param type          股票类型
 * @param market        市场代码
 * @param price         当前价格
 * @param changePercent 涨跌幅百分比
 * @param volume        成交量
 * @param amount        成交额
 * @author Koduck Team
 */
public record SymbolInfoDto(
        String symbol,
        String name,
        String type,
        String market,
        BigDecimal price,
        BigDecimal changePercent,
        Long volume,
        BigDecimal amount
) {

    /**
     * 紧凑构造函数，用于参数校验。
     */
    public SymbolInfoDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("股票代码不能为空");
        }
    }
}
