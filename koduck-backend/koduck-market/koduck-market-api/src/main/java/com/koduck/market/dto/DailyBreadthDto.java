package com.koduck.market.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Daily market breadth DTO.
 *
 * @author Koduck Team
 * @param market the market
 * @param breadthType the breadth type
 * @param tradeDate the trade date
 * @param gainers the gainers
 * @param losers the losers
 * @param unchanged the unchanged
 * @param suspended the suspended
 * @param totalStocks the total stocks
 * @param advanceDeclineLine the advance decline line
 * @param source the source
 * @param quality the quality
 * @param snapshotTime the snapshot time
 * @param updatedAt 更新时间
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DailyBreadthDto(
        String market,
        String breadthType,
        LocalDate tradeDate,
        Integer gainers,
        Integer losers,
        Integer unchanged,
        Integer suspended,
        Integer totalStocks,
        Integer advanceDeclineLine,
        String source,
        String quality,
        LocalDateTime snapshotTime,
        LocalDateTime updatedAt
) {
}
