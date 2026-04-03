package com.koduck.service;

import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;

/**
 * Service interface for technical indicator calculations.
 *
 * @author koduck
 */
public interface TechnicalIndicatorService {

    /**
     * Get available indicators.
     *
     * @return list of available technical indicators
     */
    IndicatorListResponse getAvailableIndicators();

    /**
     * Calculate indicator for a symbol.
     *
     * @param market the market identifier
     * @param symbol the stock symbol
     * @param indicator the indicator name
     * @param period the calculation period
     * @return calculated indicator response
     */
    IndicatorResponse calculateIndicator(
            String market, String symbol, String indicator, Integer period);
}
