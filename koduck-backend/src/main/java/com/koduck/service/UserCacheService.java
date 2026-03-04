package com.koduck.service;

import java.util.Set;

/**
 * User watchlist caching service interface.
 * Provides Redis-based caching for user tracking and watch lists.
 */
public interface UserCacheService {

    // ==================== User Tracking List (盯盘列表) ====================

    /**
     * Add stock to user's tracking list.
     * Key: user:track:{userId}
     *
     * @param userId  user ID
     * @param symbol  stock symbol to add
     */
    void addToUserTrackList(Long userId, String symbol);

    /**
     * Remove stock from user's tracking list.
     *
     * @param userId  user ID
     * @param symbol  stock symbol to remove
     */
    void removeFromUserTrackList(Long userId, String symbol);

    /**
     * Get user's tracking list from cache.
     *
     * @param userId user ID
     * @return set of stock symbols
     */
    Set<String> getUserTrackList(Long userId);

    /**
     * Check if stock is in user's tracking list.
     *
     * @param userId  user ID
     * @param symbol  stock symbol
     * @return true if exists
     */
    boolean isInUserTrackList(Long userId, String symbol);

    // ==================== User Watchlist (观察列表) ====================

    /**
     * Add stock to user's watchlist.
     * Key: user:watch:{userId}
     *
     * @param userId  user ID
     * @param symbol  stock symbol to add
     */
    void addToUserWatchList(Long userId, String symbol);

    /**
     * Remove stock from user's watchlist.
     *
     * @param userId  user ID
     * @param symbol  stock symbol to remove
     */
    void removeFromUserWatchList(Long userId, String symbol);

    /**
     * Get user's watchlist from cache.
     *
     * @param userId user ID
     * @return set of stock symbols
     */
    Set<String> getUserWatchList(Long userId);

    // ==================== Bulk Operations ====================

    /**
     * Cache user's tracking list (full replacement).
     *
     * @param userId   user ID
     * @param symbols  list of stock symbols
     */
    void cacheUserTrackList(Long userId, Set<String> symbols);

    /**
     * Cache user's watchlist (full replacement).
     *
     * @param userId   user ID
     * @param symbols  list of stock symbols
     */
    void cacheUserWatchList(Long userId, Set<String> symbols);

    /**
     * Invalidate user's all cached data.
     *
     * @param userId user ID
     */
    void invalidateUserCache(Long userId);
}
