package com.koduck.service;

import org.springframework.lang.NonNull;

import java.util.Set;

/**
 * User watchlist caching service interface.
 * Provides Redis-based caching for user tracking and watch lists.
 */
public interface UserCacheService {

    // ==================== User Tracking List () ====================

    /**
     * Add stock to user's tracking list.
     * Key: user:track:{userId}
     *
     * @param userId  user ID
     * @param symbol  stock symbol to add
     */
    void addToUserTrackList(@NonNull Long userId, @NonNull String symbol);

    /**
     * Remove stock from user's tracking list.
     *
     * @param userId  user ID
     * @param symbol  stock symbol to remove
     */
    void removeFromUserTrackList(@NonNull Long userId, @NonNull String symbol);

    /**
     * Get user's tracking list from cache.
     *
     * @param userId user ID
     * @return set of stock symbols
     */
    Set<String> getUserTrackList(@NonNull Long userId);

    /**
     * Check if stock is in user's tracking list.
     *
     * @param userId  user ID
     * @param symbol  stock symbol
     * @return true if exists
     */
    boolean isInUserTrackList(@NonNull Long userId, @NonNull String symbol);

    // ==================== User Watchlist () ====================

    /**
     * Add stock to user's watchlist.
     * Key: user:watch:{userId}
     *
     * @param userId  user ID
     * @param symbol  stock symbol to add
     */
    void addToUserWatchList(@NonNull Long userId, @NonNull String symbol);

    /**
     * Remove stock from user's watchlist.
     *
     * @param userId  user ID
     * @param symbol  stock symbol to remove
     */
    void removeFromUserWatchList(@NonNull Long userId, @NonNull String symbol);

    /**
     * Get user's watchlist from cache.
     *
     * @param userId user ID
     * @return set of stock symbols
     */
    Set<String> getUserWatchList(@NonNull Long userId);

    // ==================== Bulk Operations ====================

    /**
     * Cache user's tracking list (full replacement).
     *
     * @param userId   user ID
     * @param symbols  list of stock symbols
     */
    void cacheUserTrackList(@NonNull Long userId, Set<String> symbols);

    /**
     * Cache user's watchlist (full replacement).
     *
     * @param userId   user ID
     * @param symbols  list of stock symbols
     */
    void cacheUserWatchList(@NonNull Long userId, Set<String> symbols);

    /**
     * Invalidate user's all cached data.
     *
     * @param userId user ID
     */
    void invalidateUserCache(@NonNull Long userId);
}
