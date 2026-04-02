package com.koduck.service;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.KlineData;

/**
 * Service interface for K-line data operations.
 */
public interface KlineService {

    /**
     * Get K-line data for a symbol.
     * Cached for 1 minute.
     */
    List<KlineDataDto> getKlineData(String market, String symbol, String timeframe,
                                    Integer limit, Long beforeTime);

    /**
     * Get the latest price for a symbol.
     * Cached for 30 seconds.
     */
    Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe);

    /**
     * Get the previous close price (yesterday's close) for a symbol.
     * Used for calculating change and changePercent.
     * Cached for 1 minute.
     */
    Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe);

    /**
     * Get the latest K-line data record for a symbol.
     */
    Optional<KlineData> getLatestKline(String market, String symbol, String timeframe);

    /**
     * Save K-line data.
     * Clears cache for the symbol after saving.
     */
    void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe);
}
