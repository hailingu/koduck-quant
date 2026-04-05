package com.koduck.market.dto;

import java.math.BigDecimal;

/**
 * 股票估值指标数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param symbol     股票代码
 * @param peRatio    市盈率
 * @param pbRatio    市净率
 * @param psRatio    市销率
 * @param marketCap  市值
 * @param totalShares 总股本
 * @param floatShares 流通股本
 * @author Koduck Team
 */
public record StockValuationDto(
        String symbol,
        BigDecimal peRatio,
        BigDecimal pbRatio,
        BigDecimal psRatio,
        BigDecimal marketCap,
        Long totalShares,
        Long floatShares
) {
}
