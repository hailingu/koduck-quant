package com.koduck.dto.market;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Daily market breadth DTO.
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
