package com.koduck.portfolio.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
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

    /**
     * Get latest prices for multiple symbols in batch.
     * This method is optimized for N+1 query problem.
     *
     * @param symbols   list of market-symbol pairs
     * @param timeframe the timeframe
     * @return map of symbol key (format: "market:symbol") to price
     */
    Map<String, BigDecimal> getLatestPrices(List<SymbolKey> symbols, String timeframe);

    /**
     * Get previous close prices for multiple symbols in batch.
     * This method is optimized for N+1 query problem.
     *
     * @param symbols   list of market-symbol pairs
     * @param timeframe the timeframe
     * @return map of symbol key (format: "market:symbol") to price
     */
    Map<String, BigDecimal> getPreviousClosePrices(List<SymbolKey> symbols, String timeframe);
}
