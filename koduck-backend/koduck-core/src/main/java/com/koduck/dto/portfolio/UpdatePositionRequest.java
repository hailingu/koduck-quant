package com.koduck.dto.portfolio;

import java.math.BigDecimal;

import jakarta.validation.constraints.Positive;

/**
 * Request to update a position.
 *
 * @author Koduck Team
 * @param quantity the position quantity
 * @param avgCost the average cost
 */
public record UpdatePositionRequest(
    @Positive(message = "Quantity must be positive")
    BigDecimal quantity,

    @Positive(message = "Average cost must be positive")
    BigDecimal avgCost
) {}
