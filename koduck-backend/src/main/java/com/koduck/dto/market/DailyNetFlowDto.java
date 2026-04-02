package com.koduck.dto.market;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Daily market net flow DTO.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DailyNetFlowDto(
        String market,
        String flowType,
        LocalDate tradeDate,
        BigDecimal netInflow,
        BigDecimal totalInflow,
        BigDecimal totalOutflow,
        String currency,
        String source,
        String quality,
        LocalDateTime snapshotTime,
        LocalDateTime updatedAt
) {
}
