package com.koduck.common.constants;

/**
 * Shared pagination and list default constants for API endpoints.
 *
 * @author GitHub Copilot
 */
public final class PaginationConstants {

    /**
     * Default page number (0-indexed).
     */
    public static final int DEFAULT_PAGE_ZERO = 0;

    /**
     * Default page number (1-indexed).
     */
    public static final int DEFAULT_PAGE_ONE = 1;

    /**
     * Default page size.
     */
    public static final int DEFAULT_PAGE_SIZE = 20;

    /**
     * Default page number string (0-indexed).
     */
    public static final String DEFAULT_PAGE_ZERO_STR = "0";

    /**
     * Default page number string (1-indexed).
     */
    public static final String DEFAULT_PAGE_ONE_STR = "1";

    /**
     * Default page size string.
     */
    public static final String DEFAULT_PAGE_SIZE_STR = "20";

    /**
     * Maximum allowed page size.
     */
    public static final int MAX_PAGE_SIZE = 100;

    /**
     * Default K-line limit string.
     */
    public static final String DEFAULT_KLINE_LIMIT_STR = "300";

    /**
     * Default list limit string.
     */
    public static final String DEFAULT_LIST_LIMIT_STR = "10";

    /**
     * Default bubble count string.
     */
    public static final String DEFAULT_BUBBLE_COUNT_STR = "3";

    /**
     * Default tick limit string.
     */
    public static final String DEFAULT_TICK_LIMIT_STR = "50";

    private PaginationConstants() {
    }
}
