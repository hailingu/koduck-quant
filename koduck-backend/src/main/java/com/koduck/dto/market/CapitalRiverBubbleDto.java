package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.math.BigDecimal;

/**
 * Bubble node for Capital River.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverBubbleDto(
        String sectorName,
        String sectorType,
        BigDecimal mainForceNet,
        BigDecimal changePct
) {
}
