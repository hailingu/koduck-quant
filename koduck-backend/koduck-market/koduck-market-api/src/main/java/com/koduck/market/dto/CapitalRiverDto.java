package com.koduck.market.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Capital River response DTO.
 *
 * @author koduck
 * @param market the market
 * @param indicator the indicator
 * @param tradeDate the trade date
 * @param inflow the inflow
 * @param outflow the outflow
 * @param bubbles the bubbles
 * @param tracks the tracks
 * @param breadthBands the breadth bands
 * @param source the source
 * @param quality the quality
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
