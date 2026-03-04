package com.koduck.dto.portfolio;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Request to add a trade record.
 */
public record AddTradeRequest(
    @NotBlank(message = "Market cannot be blank")
    @Size(max = 20, message = "Market too long")
    String market,
    
    @NotBlank(message = "Symbol cannot be blank")
    @Size(max = 20, message = "Symbol too long")
    String symbol,
    
    @Size(max = 100, message = "Name too long")
    String name,
    
    @NotBlank(message = "Trade type is required")
    @Size(max = 10, message = "Trade type too long")
    String tradeType,
    
    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    BigDecimal quantity,
    
    @NotNull(message = "Price is required")
    @Positive(message = "Price must be positive")
    BigDecimal price,
    
    LocalDateTime tradeTime
) {}
