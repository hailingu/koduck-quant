package com.koduck.dto.portfolio;

import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Request to update a position.
 */
public record UpdatePositionRequest(
    @Positive(message = "Quantity must be positive")
    BigDecimal quantity,
    
    @Positive(message = "Average cost must be positive")
    BigDecimal avgCost
) {}
