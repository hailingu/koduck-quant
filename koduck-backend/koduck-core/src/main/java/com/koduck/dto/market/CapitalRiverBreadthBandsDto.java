package com.koduck.dto.market;

import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Bottom breadth labels and distribution values for Capital River.
 *
 * @author Koduck Team
 * @param leftLabel the left label
 * @param centerLabel the center label
 * @param rightLabel the right label
 * @param values the distribution values
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
