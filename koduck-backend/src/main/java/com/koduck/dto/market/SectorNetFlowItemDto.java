package com.koduck.dto.market;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Sector-level net-flow item DTO.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record SectorNetFlowItemDto(
        String sectorType,
        String sectorName,
        BigDecimal mainForceNet,
        BigDecimal retailNet,
        BigDecimal superBigNet,
        BigDecimal bigNet,
        BigDecimal mediumNet,
        BigDecimal smallNet,
        BigDecimal changePct,
        LocalDateTime snapshotTime
) {
}
