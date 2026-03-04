package com.koduck.dto.strategy;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

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
) {}
