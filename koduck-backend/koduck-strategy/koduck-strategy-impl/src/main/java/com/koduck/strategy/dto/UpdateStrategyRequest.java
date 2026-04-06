package com.koduck.strategy.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/**
 * Request to update a strategy.
 *
 * @author Koduck Team
 * @param name the strategy name
 * @param description the strategy description
 * @param code the strategy code
 * @param changelog the changelog for this update
 * @param parameters the list of strategy parameters
 */
public record UpdateStrategyRequest(
    @Size(max = 100, message = "Name too long")
    String name,

    @Size(max = 1000, message = "Description too long")
    String description,

    String code,

    String changelog,

    @Valid
    List<StrategyParameterRequest> parameters
) {
    /**
     * Compact constructor to make parameters immutable.
     *
     * @param name the strategy name
     * @param description the strategy description
     * @param code the strategy code
     * @param changelog the changelog
     * @param parameters the parameters list
     */
    public UpdateStrategyRequest {
        parameters = parameters == null ? null : List.copyOf(parameters);
    }
}
