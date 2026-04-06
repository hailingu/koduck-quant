package com.koduck.portfolio.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 交易记录数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param id        交易ID
 * @param market    市场代码
 * @param symbol    股票代码
 * @param name      股票名称
 * @param tradeType 交易类型（BUY/SELL）
 * @param status    交易状态
 * @param notes     交易备注
 * @param quantity  交易数量
 * @param price     交易价格
 * @param amount    成交额
 * @param tradeTime 交易时间
 * @param createdAt 创建时间
 * @author Koduck Team
 */
public record TradeDto(
        Long id,
        String market,
        String symbol,
        String name,
        String tradeType,
        String status,
        String notes,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,
        LocalDateTime tradeTime,
        LocalDateTime createdAt
) {
}
