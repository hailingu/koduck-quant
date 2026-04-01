package com.koduck.dto.market;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

/**
 * Bottom breadth labels and distribution values for Capital River.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CapitalRiverBreadthBandsDto(
        String leftLabel,
        String centerLabel,
        String rightLabel,
        List<Integer> values
) {
        public CapitalRiverBreadthBandsDto {
                values = values == null ? null : List.copyOf(values);
        }
}
