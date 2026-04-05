package com.koduck.market.service.support;

import java.util.Map;

/**
 * Utility methods for reading loosely-typed map payloads from market data-service responses.
 *
 * @author GitHub Copilot
 */
public final class MarketDataMapReader {

    private MarketDataMapReader() {
        // Prevent instantiation
    }

    public static String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }

    public static Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        }
        catch (NumberFormatException e) {
            return null;
        }
    }
}
