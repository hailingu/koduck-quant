package com.koduck.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.market.KlineData;

/**
 * Service interface for K-line data operations.
 *
 * @author Koduck Team
 */
public interface KlineService {

    /**
     * Get K-line data for a symbol.
     * Cached for 1 minute.
     *
     * @param market     the market code
     * @param symbol     the stock symbol
     * @param timeframe  the timeframe (e.g., "1d", "1h")
     * @param limit      the maximum number of records
     * @param beforeTime the timestamp to query before
     * @return list of K-line data DTOs
     */
    List<KlineDataDto> getKlineData(String market, String symbol, String timeframe,
                                    Integer limit, Long beforeTime);

    /**
     * Get the latest price for a symbol.
     * Cached for 30 seconds.
     *
     * @param market    the market code
     * @param symbol    the stock symbol
     * @param timeframe the timeframe
     * @return optional containing the latest price
     */
    Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe);

    /**
     * Get the previous close price (yesterday's close) for a symbol.
     * Used for calculating change and changePercent.
     * Cached for 1 minute.
     *
     * @param market    the market code
     * @param symbol    the stock symbol
     * @param timeframe the timeframe
     * @return optional containing the previous close price
     */
    Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe);

    /**
     * Get the latest K-line data record for a symbol.
     *
     * @param market    the market code
     * @param symbol    the stock symbol
     * @param timeframe the timeframe
     * @return optional containing the latest K-line data
     */
    Optional<KlineData> getLatestKline(String market, String symbol, String timeframe);

    /**
     * Save K-line data.
     * Clears cache for the symbol after saving.
     *
     * @param dtos      the list of K-line data DTOs
     * @param market    the market code
     * @param symbol    the stock symbol
     * @param timeframe the timeframe
     */
    void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe);

    /**
     * Normalize timeframe from period alias or explicit timeframe.
     * <p>Handles legacy period aliases (daily/weekly/monthly) and explicit timeframe values.</p>
     *
     * @param period    the period alias (daily/weekly/monthly), may be null
     * @param timeframe the explicit timeframe (1D/1W/1M), may be null
     * @return the normalized timeframe
     */
    String normalizeTimeframe(String period, String timeframe);
}
