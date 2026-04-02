package com.koduck.dto.market;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Capital River response DTO.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverDto(
        String market,
        String indicator,
        LocalDate tradeDate,
        BigDecimal inflow,
        BigDecimal outflow,
        List<CapitalRiverBubbleDto> bubbles,
        CapitalRiverTracksDto tracks,
        CapitalRiverBreadthBandsDto breadthBands,
        String source,
        String quality
) {
        public CapitalRiverDto {
                bubbles = bubbles == null ? null : List.copyOf(bubbles);
        }
}

