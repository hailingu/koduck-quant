package com.koduck.market.dto;

import java.math.BigDecimal;

/**
 * 股票交易统计数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param symbol       股票代码
 * @param market       市场代码
 * @param volume       成交量
 * @param amount       成交额
 * @param avgPrice     均价
 * @param turnoverRate 换手率
 * @param amplitude    振幅
 * @param high52w      52周最高
 * @param low52w       52周最低
 * @author Koduck Team
 */
public record StockStatsDto(
        String symbol,
        String market,
        Long volume,
        BigDecimal amount,
        BigDecimal avgPrice,
        BigDecimal turnoverRate,
        BigDecimal amplitude,
        BigDecimal high52w,
        BigDecimal low52w
) {
}
