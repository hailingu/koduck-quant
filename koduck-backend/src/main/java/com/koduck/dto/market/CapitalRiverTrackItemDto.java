package com.koduck.dto.market;
import java.math.BigDecimal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Track row item for Capital River.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverTrackItemDto(
        String sectorName,
        String sectorType,
        BigDecimal mainForceNet,
        BigDecimal changePct
) {
}
