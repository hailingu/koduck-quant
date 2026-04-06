package com.koduck.strategy.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request for strategy parameter.
 *
 * @author Koduck Team
 * @param id the parameter ID
 * @param paramName the parameter name
 * @param paramType the parameter type
 * @param defaultValue the default value
 * @param minValue the minimum value
 * @param maxValue the maximum value
 * @param description the parameter description
 * @param isRequired whether the parameter is required
 * @param sortOrder the sort order
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
