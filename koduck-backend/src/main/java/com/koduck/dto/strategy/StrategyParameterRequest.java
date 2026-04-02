package com.koduck.dto.strategy;
import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request for strategy parameter.
 */
public record StrategyParameterRequest(
    Long id,
    
    @NotBlank(message = "Parameter name is required")
    @Size(max = 50, message = "Parameter name too long")
    String paramName,
    
    @NotNull(message = "Parameter type is required")
    String paramType,
    
    String defaultValue,
    
    BigDecimal minValue,
    
    BigDecimal maxValue,
    
    String description,
    
    @NotNull(message = "isRequired is required")
    Boolean isRequired,
    
    Integer sortOrder
) {}
