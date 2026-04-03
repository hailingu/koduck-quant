package com.koduck.dto.market;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Bubble node for Capital River.
 *
 * @author Koduck Team
 * @param sectorName the sector name
 * @param sectorType the sector type
 * @param mainForceNet the main force net inflow
 * @param changePct the change percentage
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverBubbleDto(
        String sectorName,
        String sectorType,
        BigDecimal mainForceNet,
        BigDecimal changePct
) {
}
