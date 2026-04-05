package com.koduck.market.dto;

import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Grouped track lists for Capital River.
 *
 * @author Koduck Team
 * @param industry the industry track list
 * @param concept the concept track list
 * @param region the region track list
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
