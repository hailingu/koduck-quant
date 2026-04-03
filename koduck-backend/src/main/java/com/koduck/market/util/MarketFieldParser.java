package com.koduck.market.util;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Helper methods for parsing typed values from map-based payloads.
 *
 * @author Koduck Team
 */
public final class MarketFieldParser {

    private MarketFieldParser() {
        // Utility class.
    }

    /**
     * Reads a string value from map payload.
     *
     * @param data source map
     * @param key key name
     * @return string representation or null
     */
    public static String toStringValue(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }

    /**
     * Reads a long value from map payload.
     *
     * @param data source map
     * @param key key name
     * @return parsed long or null when absent/invalid
     */
    public static Long toLong(Map<String, Object> data, String key) {
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
        catch (NumberFormatException _) {
            return null;
        }
    }

    /**
     * Reads a decimal value from map payload.
     *
     * @param data source map
     * @param key key name
     * @return parsed decimal or null when absent/invalid
     */
    public static BigDecimal toBigDecimal(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
        }
        catch (NumberFormatException _) {
            return null;
        }
    }
}
