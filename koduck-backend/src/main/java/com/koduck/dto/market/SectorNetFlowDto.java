package com.koduck.dto.market;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

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
        public SectorNetFlowDto {
                industry = industry == null ? null : List.copyOf(industry);
                concept = concept == null ? null : List.copyOf(concept);
                region = region == null ? null : List.copyOf(region);
        }
}
