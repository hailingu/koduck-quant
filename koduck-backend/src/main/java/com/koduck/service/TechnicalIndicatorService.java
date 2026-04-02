package com.koduck.service;
import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;

/**
 * Service interface for technical indicator calculations.
 */
public interface TechnicalIndicatorService {
    
    /**
     * Get available indicators.
     */
    IndicatorListResponse getAvailableIndicators();
    
    /**
     * Calculate indicator for a symbol.
     */
    IndicatorResponse calculateIndicator(String market, String symbol, String indicator, Integer period);
}
