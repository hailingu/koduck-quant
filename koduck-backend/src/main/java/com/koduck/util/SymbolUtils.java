package com.koduck.util;

import lombok.extern.slf4j.Slf4j;

/**
 * Utility class for stock symbol normalization and comparison.
 * Handles various symbol formats: SH601012, sh601012, 601012.SH, 601012
 */
@Slf4j
public class SymbolUtils {

    private SymbolUtils() {
        // Utility class, no instantiation
    }

    /**
     * Normalize stock symbol to standard 6-digit format.
     * 
     * Input examples: 601012, SH601012, sh601012, 601012.SH, sz300001
     * Output: 601012
     *
     * @param symbol the input symbol
     * @return normalized 6-digit symbol, or original if invalid
     */
    public static String normalize(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return symbol;
        }

        // Convert to uppercase and remove all non-digit characters
        String normalized = symbol.toUpperCase()
                .replace(".SH", "")
                .replace(".SZ", "")
                .replace(".BJ", "")
                .replace("SH", "")
                .replace("SZ", "")
                .replace("BJ", "")
                .replaceAll("[^0-9]", "")
                .trim();

        // Validate it's a 6-digit number
        if (!normalized.matches("\\d{6}")) {
            log.warn("Invalid symbol format: {} (original: {})", normalized, symbol);
            return symbol;
        }

        return normalized;
    }

    /**
     * Check if two symbols match (ignoring market prefix and case).
     *
     * @param symbol1 first symbol
     * @param symbol2 second symbol
     * @return true if normalized forms match
     */
    public static boolean matches(String symbol1, String symbol2) {
        if (symbol1 == null || symbol2 == null) {
            return symbol1 == symbol2;
        }
        return normalize(symbol1).equals(normalize(symbol2));
    }

    /**
     * Get market prefix from symbol if present.
     *
     * @param symbol the symbol (e.g., SH601012, 601012)
     * @return market prefix (SH, SZ, BJ) or null if not found
     */
    public static String getMarketPrefix(String symbol) {
        if (symbol == null || symbol.length() < 2) {
            return null;
        }

        String upper = symbol.toUpperCase();
        if (upper.startsWith("SH")) {
            return "SH";
        } else if (upper.startsWith("SZ")) {
            return "SZ";
        } else if (upper.startsWith("BJ")) {
            return "BJ";
        }
        return null;
    }
}
