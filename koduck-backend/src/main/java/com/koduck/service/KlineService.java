package com.koduck.service;

import com.koduck.config.CacheConfig;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.KlineData;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Service interface for K-line data operations.
 */
public interface KlineService {

    /**
     * Get K-line data for a symbol.
     * Cached for 1 minute.
     */
    @Cacheable(
            value = CacheConfig.CACHE_KLINE,
            key = "#market + ':' + #symbol + ':' + #timeframe + ':' + #limit + ':' + #beforeTime",
            unless = "#result == null || #result.isEmpty()")
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
    @Cacheable(value = CacheConfig.CACHE_KLINE, key = "#market + ':' + #symbol + ':' + #timeframe + ':prevClose'")
    Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe);

    /**
     * Get the latest K-line data record for a symbol.
     */
    Optional<KlineData> getLatestKline(String market, String symbol, String timeframe);

    /**
     * Save K-line data.
     * Clears cache for the symbol after saving.
     */
    @Caching(evict = {
            @CacheEvict(value = CacheConfig.CACHE_KLINE, allEntries = true),
            @CacheEvict(value = CacheConfig.CACHE_PRICE, key = "#market + ':' + #symbol + ':' + #timeframe")
    })
    void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe);
}
