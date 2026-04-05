package com.koduck.portfolio.service;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Portfolio module price service interface.
 * Provides price data for portfolio calculations.
 *
 * @author Koduck Team
 */
public interface PortfolioPriceService {

    /**
     * Get the latest price for a symbol.
     *
     * @param market    the market code
     * @param symbol    the symbol
     * @param timeframe the timeframe
     * @return optional containing the latest price
     */
    Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe);

    /**
     * Get the previous close price for a symbol.
     *
     * @param market    the market code
     * @param symbol    the symbol
     * @param timeframe the timeframe
     * @return optional containing the previous close price
     */
    Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe);
}
