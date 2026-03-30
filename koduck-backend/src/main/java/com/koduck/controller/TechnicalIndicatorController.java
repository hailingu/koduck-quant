package com.koduck.controller;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;
import com.koduck.service.TechnicalIndicatorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
/**
 * Technical Indicator REST API controller.
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@RestController
@RequestMapping("/api/v1/indicators")
@RequiredArgsConstructor
@Validated
@Slf4j
@Tag(name = "Technical Indicators", description = "Indicator listing and calculation endpoints")
public class TechnicalIndicatorController {
    private static final String DEFAULT_PERIOD = "20";
    private final TechnicalIndicatorService indicatorService;
    /**
     * Get available technical indicators.
     *
     * @return available indicator definitions
     */
    @GetMapping
    @Operation(summary = "Get available technical indicators")
    public ApiResponse<IndicatorListResponse> getAvailableIndicators() {
        log.debug("GET /api/v1/indicators");
        IndicatorListResponse indicators = indicatorService.getAvailableIndicators();
        return ApiResponse.success(indicators);
    }
    /**
     * Calculate technical indicator for a symbol.
     *
     * Example: GET /api/v1/indicators/{symbol}?market=AShare&indicator=MA&period=20
     *
     * @param symbol stock symbol
     * @param market market identifier
     * @param indicator indicator type
     * @param period indicator period, defaults to 20
     * @return indicator calculation result
     */
    @GetMapping("/{symbol}")
    @Operation(summary = "Calculate one technical indicator for a symbol")
    public ApiResponse<IndicatorResponse> calculateIndicator(
            @PathVariable @NotBlank String symbol,
            @RequestParam @NotBlank String market,
            @RequestParam @NotBlank String indicator,
            @RequestParam(defaultValue = DEFAULT_PERIOD) @Positive Integer period) {
        log.debug(
                "GET /api/v1/indicators/{}: market={}, indicator={}, period={}",
                symbol,
                market,
                indicator,
                period);
        IndicatorResponse response = indicatorService.calculateIndicator(market, symbol, indicator, period);
        return ApiResponse.success(response);
    }
}
