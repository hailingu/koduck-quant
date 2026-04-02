package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Daily market net flow DTO.
 *
 * @author Koduck
 * @param market the market
 * @param flowType the flow type
 * @param tradeDate the trade date
 * @param netInflow the net inflow
 * @param totalInflow the total inflow
 * @param totalOutflow the total outflow
 * @param currency the currency
 * @param source the source
 * @param quality the quality
 * @param snapshotTime the snapshot time
 * @param updatedAt the updated at
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
