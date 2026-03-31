package com.koduck.common.constants;

import org.springframework.lang.NonNull;

/**
 * Redis key constants for the caching layer.
 * Defines all key patterns used for caching stock data and user watchlists.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class RedisKeyConstants {

    private RedisKeyConstants() {
        // Prevent instantiation
    }

    /**
     * Stock tracking real-time data (Hash)
     * Key pattern: stock:track:{symbol}
     * TTL: 10 seconds
     */
    public static final String STOCK_TRACK_PREFIX = "stock:track:";

    /**
     * TTL for stock tracking real-time data: 10 seconds
     */
    public static final long TTL_STOCK_TRACK = 10;

    /**
     * Stock watch 1-minute K-line (Sorted Set)
     * Key pattern: stock:watch:1m:{symbol}
     * TTL: 3600 seconds (1 hour)
     */
    public static final String STOCK_WATCH_1M_PREFIX = "stock:watch:1m:";

    /**
     * Stock watch 5-minute K-line (Sorted Set)
     * Key pattern: stock:watch:5m:{symbol}
     * TTL: 3600 seconds (1 hour)
     */
    public static final String STOCK_WATCH_5M_PREFIX = "stock:watch:5m:";

    /**
     * Stock watch daily K-line (Sorted Set)
     * Key pattern: stock:watch:daily:{symbol}
     * TTL: 86400 seconds (24 hours)
     */
    public static final String STOCK_WATCH_DAILY_PREFIX = "stock:watch:daily:";

    /**
     * Hot stocks list - List
     * Key pattern: hot:stocks:{type}
     * TTL: 60 seconds
     * Types: volume, gain, loss
     */
    public static final String HOT_STOCKS_PREFIX = "hot:stocks:";

    /**
     * Hot stocks by volume
     */
    public static final String HOT_STOCKS_VOLUME = "volume";

    /**
     * Hot stocks by gain
     */
    public static final String HOT_STOCKS_GAIN = "gain";

    /**
     * Hot stocks by loss
     */
    public static final String HOT_STOCKS_LOSS = "loss";

    /**
     * User tracking list (Set)
     * Key pattern: user:track:{userId}
     * TTL: Permanent (session-level)
     */
    public static final String USER_TRACK_PREFIX = "user:track:";

    /**
     * User watchlist (Set)
     * Key pattern: user:watch:{userId}
     * TTL: Permanent (session-level)
     */
    public static final String USER_WATCH_PREFIX = "user:watch:";

    /**
     * TTL for watch K-line data: 1 hour
     * Applies to intraday K-line caches (1m and 5m).
     */
    public static final long TTL_STOCK_WATCH_KLINE = 3600;

    /**
     * TTL for hot stocks: 60 seconds
     */
    public static final long TTL_HOT_STOCKS = 60;

    /**
     * TTL for daily K-line: 24 hours
     */
    public static final long TTL_STOCK_WATCH_DAILY = 86400;

    /**
     * Generate stock tracking key.
     *
     * @param symbol stock symbol
     * @return Redis key in pattern {@code stock:track:{symbol}}
     */
    public static String stockTrackKey(String symbol) {
        return STOCK_TRACK_PREFIX + symbol;
    }

    /**
     * Generate stock watch 1m K-line key.
     *
     * @param symbol stock symbol
     * @return Redis key in pattern {@code stock:watch:1m:{symbol}}
     */
    public static String stockWatch1mKey(String symbol) {
        return STOCK_WATCH_1M_PREFIX + symbol;
    }

    /**
     * Generate stock watch 5m K-line key.
     *
     * @param symbol stock symbol
     * @return Redis key in pattern {@code stock:watch:5m:{symbol}}
     */
    public static String stockWatch5mKey(String symbol) {
        return STOCK_WATCH_5M_PREFIX + symbol;
    }

    /**
     * Generate stock watch daily K-line key.
     *
     * @param symbol stock symbol
     * @return Redis key in pattern {@code stock:watch:daily:{symbol}}
     */
    public static String stockWatchDailyKey(String symbol) {
        return STOCK_WATCH_DAILY_PREFIX + symbol;
    }

    /**
     * Generate hot stocks key.
     *
     * @param type hot stock type, e.g. {@code volume}, {@code gain}, {@code loss}
     * @return Redis key in pattern {@code hot:stocks:{type}}
     */
    public static String hotStocksKey(String type) {
        return HOT_STOCKS_PREFIX + type;
    }

    /**
     * Generate user tracking key.
     *
     * @param userId user identifier
     * @return Redis key in pattern {@code user:track:{userId}}
     */
    public static @NonNull String userTrackKey(Long userId) {
        return USER_TRACK_PREFIX + userId;
    }

    /**
     * Generate user watchlist key.
     *
     * @param userId user identifier
     * @return Redis key in pattern {@code user:watch:{userId}}
     */
    public static @NonNull String userWatchKey(Long userId) {
        return USER_WATCH_PREFIX + userId;
    }
}
