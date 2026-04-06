package com.koduck.portfolio.service;

import java.util.Objects;

/**
 * Symbol identifier for batch queries.
 * Combines market and symbol for unique identification.
 *
 * @param market  the market code (e.g., "US", "CN")
 * @param symbol  the symbol (e.g., "AAPL", "000001")
 * @author Koduck Team
 */
public record SymbolKey(String market, String symbol) {

    /**
     * Creates a new SymbolKey with validation.
     *
     * @param market the market code
     * @param symbol the symbol
     */
    public SymbolKey {
        Objects.requireNonNull(market, "market must not be null");
        Objects.requireNonNull(symbol, "symbol must not be null");
    }

    /**
     * Converts to a composite key string.
     * Format: "market:symbol"
     *
     * @return the composite key
     */
    public String toKey() {
        return market + ":" + symbol;
    }

    /**
     * Parses a composite key string into SymbolKey.
     * Format: "market:symbol"
     *
     * @param key the composite key
     * @return the SymbolKey
     * @throws IllegalArgumentException if format is invalid
     */
    public static SymbolKey fromKey(String key) {
        Objects.requireNonNull(key, "key must not be null");
        int separatorIndex = key.indexOf(':');
        if (separatorIndex < 0) {
            throw new IllegalArgumentException(
                "Invalid key format. Expected 'market:symbol', got: " + key);
        }
        String market = key.substring(0, separatorIndex);
        String symbol = key.substring(separatorIndex + 1);
        return new SymbolKey(market, symbol);
    }
}
