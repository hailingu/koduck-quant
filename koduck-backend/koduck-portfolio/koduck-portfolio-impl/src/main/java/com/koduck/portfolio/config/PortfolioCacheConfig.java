package com.koduck.portfolio.config;

/**
 * Portfolio module cache configuration constants.
 *
 * @author Koduck Team
 */
public final class PortfolioCacheConfig {

    private PortfolioCacheConfig() {
        // Utility class
    }

    /** Cache name for portfolio summary. */
    public static final String CACHE_PORTFOLIO_SUMMARY = "portfolioSummary";

    /** Cache name for latest price. */
    public static final String CACHE_PRICE_LATEST = "priceLatest";

    /** Cache name for previous close price. */
    public static final String CACHE_PRICE_PREVIOUS_CLOSE = "pricePreviousClose";
}
