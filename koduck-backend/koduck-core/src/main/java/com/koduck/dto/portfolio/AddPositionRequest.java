package com.koduck.dto.portfolio;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Request to add a position to portfolio.
 *
 * @author Koduck Team
 * @param market  the market code (e.g., US, HK, CN)
 * @param symbol  the stock symbol
 * @param name    the stock name
 * @param quantity the position quantity
 * @param avgCost the average cost per share
 */
public record AddPositionRequest(
    @NotBlank(message = "Market cannot be blank")
    @Size(max = 20, message = "Market too long")
    String market,

    @NotBlank(message = "Symbol cannot be blank")
    @Size(max = 20, message = "Symbol too long")
    String symbol,

    @Size(max = 100, message = "Name too long")
    String name,

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    BigDecimal quantity,

    @NotNull(message = "Average cost is required")
    @Positive(message = "Average cost must be positive")
    BigDecimal avgCost
) {}
