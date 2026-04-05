package com.koduck.market.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 实时价格行情数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param symbol        品种代码
 * @param name          名称
 * @param type          类型
 * @param price         当前价格
 * @param open          开盘价
 * @param high          最高价
 * @param low           最低价
 * @param prevClose     前收盘价
 * @param volume        成交量
 * @param amount        成交额
 * @param change        涨跌额
 * @param changePercent 涨跌幅
 * @param bidPrice      买入价
 * @param bidVolume     买入量
 * @param askPrice      卖出价
 * @param askVolume     卖出量
 * @param timestamp     时间戳
 * @author Koduck Team
 */
public record PriceQuoteDto(
        String symbol,
        String name,
        String type,
        BigDecimal price,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal prevClose,
        Long volume,
        BigDecimal amount,
        BigDecimal change,
        BigDecimal changePercent,
        BigDecimal bidPrice,
        Long bidVolume,
        BigDecimal askPrice,
        Long askVolume,
        Instant timestamp
) {

    /**
     * 紧凑构造函数，用于参数校验。
     */
    public PriceQuoteDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("品种代码不能为空");
        }
    }
}
