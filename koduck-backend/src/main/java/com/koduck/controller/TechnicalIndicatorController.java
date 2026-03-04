package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;
import com.koduck.service.TechnicalIndicatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.constraints.NotBlank;

/**
 * Technical Indicator REST API controller.
 */
@RestController
@RequestMapping("/api/v1/indicators")
@RequiredArgsConstructor
@Validated
@Slf4j
public class TechnicalIndicatorController {
    
    private final TechnicalIndicatorService indicatorService;
    
    /**
     * Get available technical indicators.
     */
    @GetMapping
    public ApiResponse<IndicatorListResponse> getAvailableIndicators() {
        log.debug("GET /api/v1/indicators");
        
        IndicatorListResponse indicators = indicatorService.getAvailableIndicators();
        return ApiResponse.success(indicators);
    }
    
    /**
     * Calculate technical indicator for a symbol.
     * 
     * Example: GET /api/v1/indicators/000001?market=AShare&indicator=MA&period=20
     */
    @GetMapping("/{symbol}")
    public ApiResponse<IndicatorResponse> calculateIndicator(
            @PathVariable @NotBlank String symbol,
            @RequestParam @NotBlank String market,
            @RequestParam @NotBlank String indicator,
            @RequestParam(required = false) Integer period) {
        
        log.debug("GET /api/v1/indicators/{}: market={}, indicator={}, period={}", 
                 symbol, market, indicator, period);
        
        IndicatorResponse response = indicatorService.calculateIndicator(market, symbol, indicator, period);
        return ApiResponse.success(response);
    }
}
