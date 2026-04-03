package com.koduck.service;

import java.util.List;

import com.koduck.dto.market.KlineDataDto;

/**
 * Service interface for minute-level K-line data.
 * Fetches real-time minute data from Python Data Service.
 */
public interface KlineMinutesService {

    /**
     * Get minute-level K-line data.
     *
     * @param market Market type (e.g., "AShare")
     * @param symbol Stock symbol
     * @param timeframe Minute timeframe (1m, 5m, 15m, 30m, 60m)
     * @param limit Maximum number of records
     * @param beforeTime Get data before this timestamp (optional)
     * @return List of K-line data
     */
    List<KlineDataDto> getMinuteKline(String market, String symbol, String timeframe,
                                      Integer limit, Long beforeTime);

    /**
     * Check if timeframe is minute-level.
     *
     * @param timeframe The timeframe to check
     * @return true if the timeframe is minute-level
     */
    boolean isMinuteTimeframe(String timeframe);
}
