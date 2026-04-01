package com.koduck.service.market.support;

import java.time.Duration;
import java.util.Locale;

/**
 * Shared timeframe parsing helpers used by market providers.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class MarketTimeframeParser {

    private MarketTimeframeParser() {
    }

    public static Duration parseStandard(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "1m" -> Duration.ofMinutes(1);
            case "5m" -> Duration.ofMinutes(5);
            case "15m" -> Duration.ofMinutes(15);
            case "30m" -> Duration.ofMinutes(30);
            case "1h", "60m" -> Duration.ofHours(1);
            case "1d", "daily" -> Duration.ofDays(1);
            case "1w", "weekly" -> Duration.ofDays(7);
            case "1mth", "monthly" -> Duration.ofDays(30);
            default -> Duration.ofDays(1);
        };
    }

    public static Duration parseWithFourHour(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "4h" -> Duration.ofHours(4);
            default -> parseStandard(timeframe);
        };
    }

    public static Duration parseWithTwoAndFourHour(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "2h" -> Duration.ofHours(2);
            case "4h" -> Duration.ofHours(4);
            default -> parseStandard(timeframe);
        };
    }
}
