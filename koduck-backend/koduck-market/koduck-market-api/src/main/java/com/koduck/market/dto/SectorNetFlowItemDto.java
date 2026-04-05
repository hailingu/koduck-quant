package com.koduck.market.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Sector-level net-flow item DTO.
 *
 * @author Koduck Team
 * @param sectorType the sector type
 * @param sectorName the sector name
 * @param mainForceNet the main force net
 * @param retailNet the retail net
 * @param superBigNet the super big net
 * @param bigNet the big net
 * @param mediumNet the medium net
 * @param smallNet the small net
 * @param changePct the change percent
 * @param snapshotTime the snapshot time
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
