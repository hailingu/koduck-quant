package com.koduck.dto.backtest;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Request to run a backtest.
 *
 * @param strategyId Strategy ID
 * @param market Market
 * @param symbol Symbol
 * @param startDate Start date
 * @param endDate End date
 * @param timeframe Timeframe
 * @param initialCapital Initial capital
 * @param commissionRate Commission rate
 * @param slippage Slippage
 * @author Koduck Team
 */
public record RunBacktestRequest(
    @NotNull(message = "Strategy ID is required")
    Long strategyId,

    @NotBlank(message = "Market is required")
    @Size(max = 20, message = "Market too long")
    String market,

    @NotBlank(message = "Symbol is required")
    @Size(max = 20, message = "Symbol too long")
    String symbol,

    @NotNull(message = "Start date is required")
    LocalDate startDate,

    @NotNull(message = "End date is required")
    LocalDate endDate,

    @Size(max = 10, message = "Timeframe too long")
    String timeframe,

    @NotNull(message = "Initial capital is required")
    @Positive(message = "Initial capital must be positive")
    BigDecimal initialCapital,

    BigDecimal commissionRate,

    BigDecimal slippage
) {
}
