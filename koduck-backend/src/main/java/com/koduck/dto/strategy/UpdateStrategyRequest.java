package com.koduck.dto.strategy;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/**
 * Request to update a strategy.
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
    public UpdateStrategyRequest {
        parameters = parameters == null ? null : List.copyOf(parameters);
    }
}
