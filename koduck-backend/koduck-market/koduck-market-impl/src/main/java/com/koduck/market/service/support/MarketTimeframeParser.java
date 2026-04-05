package com.koduck.market.service.support;

import java.time.Duration;
import java.util.Locale;

/**
 * Shared timeframe parsing helpers used by market providers.
 *
 * @author Koduck Team
 */
public final class MarketTimeframeParser {

    /** Number of minutes in a 5-minute interval. */
    private static final int MINUTES_IN_5M = 5;

    /** Number of minutes in a 15-minute interval. */
    private static final int MINUTES_IN_15M = 15;

    /** Number of minutes in a 30-minute interval. */
    private static final int MINUTES_IN_30M = 30;

    /** Number of days in a week. */
    private static final int DAYS_IN_WEEK = 7;

    /** Number of days in a month (approximate). */
    private static final int DAYS_IN_MONTH = 30;

    /** Number of hours in a 4-hour interval. */
    private static final int HOURS_IN_4H = 4;

    private MarketTimeframeParser() {
    }

    public static Duration parseStandard(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "1m" -> Duration.ofMinutes(1);
            case "5m" -> Duration.ofMinutes(MINUTES_IN_5M);
            case "15m" -> Duration.ofMinutes(MINUTES_IN_15M);
            case "30m" -> Duration.ofMinutes(MINUTES_IN_30M);
            case "1h", "60m" -> Duration.ofHours(1);
            case "1d", "daily" -> Duration.ofDays(1);
            case "1w", "weekly" -> Duration.ofDays(DAYS_IN_WEEK);
            case "1mth", "monthly" -> Duration.ofDays(DAYS_IN_MONTH);
            default -> Duration.ofDays(1);
        };
    }

    public static Duration parseWithFourHour(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "4h" -> Duration.ofHours(HOURS_IN_4H);
            default -> parseStandard(timeframe);
        };
    }

    public static Duration parseWithTwoAndFourHour(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "2h" -> Duration.ofHours(2);
            case "4h" -> Duration.ofHours(HOURS_IN_4H);
            default -> parseStandard(timeframe);
        };
    }
}
