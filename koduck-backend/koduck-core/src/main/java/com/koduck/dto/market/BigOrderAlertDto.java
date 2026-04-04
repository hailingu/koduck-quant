package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record BigOrderAlertDto(
        String id,
        String symbol,
        String name,
        String type,
        Double amount,
        String amountFormatted,
        Double price,
        Integer volume,
        String time,
        String typeLabel,
        String exchange,
        String urgency
) {
}
