package com.koduck.dto.strategy;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request to create a strategy.
 *
 * @param name        the strategy name
 * @param description the strategy description
 * @param code        the strategy code
 * @param parameters  the strategy parameters
 * @author Koduck Team
 */
public record CreateStrategyRequest(
    @NotBlank(message = "Strategy name is required")
    @Size(max = 100, message = "Name too long")
    String name,

    @Size(max = 1000, message = "Description too long")
    String description,

    String code,

    @Valid
    List<StrategyParameterRequest> parameters
) {
    public CreateStrategyRequest {
        parameters = parameters == null ? null : List.copyOf(parameters);
    }
}
