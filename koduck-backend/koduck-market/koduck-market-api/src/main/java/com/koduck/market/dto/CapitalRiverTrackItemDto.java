package com.koduck.market.dto;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Track row item for Capital River.
 *
 * @param sectorName   the sector name
 * @param sectorType   the sector type
 * @param mainForceNet the main force net inflow
 * @param changePct    the change percentage
 * @author Koduck Team
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverTrackItemDto(
        String sectorName,
        String sectorType,
        BigDecimal mainForceNet,
        BigDecimal changePct
) {
}
