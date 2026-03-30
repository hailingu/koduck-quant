package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

/**
 * Grouped track lists for Capital River.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverTracksDto(
        List<CapitalRiverTrackItemDto> industry,
        List<CapitalRiverTrackItemDto> concept,
        List<CapitalRiverTrackItemDto> region
) {
        public CapitalRiverTracksDto {
                industry = industry == null ? null : List.copyOf(industry);
                concept = concept == null ? null : List.copyOf(concept);
                region = region == null ? null : List.copyOf(region);
        }
}
