package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Sector net-flow response DTO.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record SectorNetFlowDto(
        String market,
        String indicator,
        LocalDate tradeDate,
        BigDecimal totalMainForceNet,
        BigDecimal totalRetailNet,
        List<SectorNetFlowItemDto> industry,
        List<SectorNetFlowItemDto> concept,
        List<SectorNetFlowItemDto> region,
        String source,
        String quality
) {
}
