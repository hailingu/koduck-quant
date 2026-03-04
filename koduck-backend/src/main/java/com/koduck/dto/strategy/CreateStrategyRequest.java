package com.koduck.dto.strategy;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request to create a strategy.
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
) {}
