package com.koduck.service;
import com.koduck.dto.market.RealtimePriceEventMessage;

/**
 * Service for pushing and caching realtime market prices.
 *
 * <p>This service supports receiving realtime events, checking and pushing
 * price updates, and in-memory cache management.</p>
 *
 * @author koduck
 * @date 2026-03-31
 */
public interface PricePushService {

    /**
     * Check for pending price updates and push those updates to subscribers.
     *
     * <p>This method may be triggered periodically or on demand. It should
     * validate that there are new price changes before invoking downstream
     * notification paths.</p>
     */
    void checkAndPushPriceUpdates();

    /**
     * Handle a realtime price event from upstream data service (via MQ).
     *
     * @param event realtime price event payload, must not be null
     */
    void onRealtimePriceEvent(RealtimePriceEventMessage event);

    /**
     * Clear all cached realtime price entries in memory.
     */
    void clearCache();

    /**
     * Get the count of cached realtime price records.
     *
     * @return number of cached price entries, non-negative
     */
    int getCachedPriceCount();
}
