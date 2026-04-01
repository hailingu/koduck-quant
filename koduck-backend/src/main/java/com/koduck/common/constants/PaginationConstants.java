package com.koduck.common.constants;

/**
 * Shared pagination and list default constants for API endpoints.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class PaginationConstants {

    public static final int DEFAULT_PAGE_ZERO = 0;
    public static final int DEFAULT_PAGE_ONE = 1;
    public static final int DEFAULT_PAGE_SIZE = 20;

    public static final String DEFAULT_PAGE_ZERO_STR = "0";
    public static final String DEFAULT_PAGE_ONE_STR = "1";
    public static final String DEFAULT_PAGE_SIZE_STR = "20";

    public static final int MAX_PAGE_SIZE = 100;
    public static final String DEFAULT_KLINE_LIMIT_STR = "300";
    public static final String DEFAULT_LIST_LIMIT_STR = "10";
    public static final String DEFAULT_BUBBLE_COUNT_STR = "3";
    public static final String DEFAULT_TICK_LIMIT_STR = "50";

    private PaginationConstants() {
    }
}
