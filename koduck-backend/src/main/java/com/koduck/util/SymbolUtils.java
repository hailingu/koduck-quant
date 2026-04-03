package com.koduck.util;

import java.util.Locale;
import java.util.Objects;

import lombok.extern.slf4j.Slf4j;

/**
 * Utility helpers for stock symbol normalization and comparison.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Slf4j
public final class SymbolUtils {

    private SymbolUtils() {
    }

    /**
     * Normalizes a stock symbol to the standard 6-digit format.
     *
     * @param symbol input symbol
     * @return normalized 6-digit symbol, or the original input if invalid
     */
    public static String normalize(final String symbol) {
        String normalizedSymbol = symbol;
        if (symbol == null || symbol.isBlank()) {
            return normalizedSymbol;
        }

        normalizedSymbol = symbol.toUpperCase(Locale.ROOT).replace(".SH", "").replace(".SZ", "").replace(".BJ", "").replace("SH", "").replace("SZ", "").replace("BJ", "").replaceAll("\\D", "").trim();

        if (normalizedSymbol.matches("\\d{1,6}")) {
            normalizedSymbol = String.format("%06d", Integer.parseInt(normalizedSymbol));
        } else {
            if (log.isWarnEnabled()) {
                log.warn("Invalid symbol format: {} (original: {})", normalizedSymbol, symbol);
            }
            normalizedSymbol = symbol;
        }
        return normalizedSymbol;
    }

    /**
     * Checks whether two symbols match after normalization.
     *
     * @param symbol1 first symbol
     * @param symbol2 second symbol
     * @return true when normalized forms match
     */
    public static boolean matches(final String symbol1, final String symbol2) {
        boolean matched;
        if (symbol1 == null || symbol2 == null) {
            matched = Objects.equals(symbol1, symbol2);
        } else {
            matched = normalize(symbol1).equals(normalize(symbol2));
        }
        return matched;
    }

    /**
     * Returns the market prefix from a symbol if present.
     *
     * @param symbol source symbol
     * @return market prefix or null when absent
     */
    public static String getMarketPrefix(final String symbol) {
        String marketPrefix = null;
        if (symbol == null || symbol.length() < 2) {
            return marketPrefix;
        }

        final String upper = symbol.toUpperCase(Locale.ROOT);
        if (upper.startsWith("SH")) {
            marketPrefix = "SH";
        } else if (upper.startsWith("SZ")) {
            marketPrefix = "SZ";
        } else if (upper.startsWith("BJ")) {
            marketPrefix = "BJ";
        }
        return marketPrefix;
    }
}
