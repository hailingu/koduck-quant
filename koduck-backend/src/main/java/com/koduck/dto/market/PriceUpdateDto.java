package com.koduck.dto.market;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Price update data transfer object.
 * Used for real-time price updates and WebSocket messages.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceUpdateDto {

    /** The stock symbol. */
    private String symbol;

    /** The stock name. */
    private String name;

    /** The current price. */
    private Double price;

    /** The price change. */
    private Double change;

    /** The price change percentage. */
    private Double changePercent;

    /** The trading volume. */
    private Long volume;
}
