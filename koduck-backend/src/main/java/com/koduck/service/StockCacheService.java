package com.koduck.service;

import java.util.List;

import com.koduck.dto.market.PriceQuoteDto;

/**
 * Stock data caching service interface.
 * Provides Redis-based caching for stock real-time data and K-line data.
 *
 * @author GitHub Copilot
 */
public interface StockCacheService {

    // ==================== Stock Tracking () ====================

    /**
     * Cache stock real-time quote data.
     * Key: stock:track:{symbol}, TTL: 10 seconds
     *
     * @param symbol stock symbol
     * @param quote  price quote data
     */
    void cacheStockTrack(String symbol, PriceQuoteDto quote);

    /**
     * Get cached stock real-time quote.
     *
     * @param symbol stock symbol
     * @return cached price quote or null if not found
     */
    PriceQuoteDto getCachedStockTrack(String symbol);

    /**
     * Get multiple cached stock quotes.
     *
     * @param symbols list of stock symbols
     * @return map of symbol to price quote
     */
    List<PriceQuoteDto> getCachedStockTracks(List<String> symbols);

    // ==================== Hot Stocks ====================

    /**
     * Cache hot stocks list.
     * Key: hot:stocks:{type}, TTL: 60 seconds
     *
     * @param type    hot stock type (volume, gain, loss)
     * @param symbols list of stock symbols
     */
    void cacheHotStocks(String type, List<String> symbols);

    /**
     * Get cached hot stocks list.
     *
     * @param type hot stock type (volume, gain, loss)
     * @return list of stock symbols or null if not found
     */
    List<String> getCachedHotStocks(String type);

    // ==================== Batch Operations ====================

    /**
     * Cache batch of stock quotes.
     *
     * @param quotes list of price quotes
     */
    void cacheBatchStockTracks(List<PriceQuoteDto> quotes);

    /**
     * Check if stock data exists in cache.
     *
     * @param symbol stock symbol
     * @return true if cached
     */
    boolean isStockTrackCached(String symbol);
}
