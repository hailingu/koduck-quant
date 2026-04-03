package com.koduck.market.provider;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;

/**
 * Interface for market data providers.
 * All market data sources must implement this interface.
 *
 * @author Koduck Team
 */
public interface MarketDataProvider {

    /** Maximum health score value (100%). */
    int MAX_HEALTH_SCORE = 100;

    /** Minimum health score value (0%). */
    int MIN_HEALTH_SCORE = 0;

    /**
     * Get the provider name.
     *
     * @return provider identifier name
     */
    String getProviderName();

    /**
     * Get the supported market type.
     *
     * @return MarketType this provider supports
     */
    MarketType getMarketType();

    /**
     * Check if the provider is available.
     *
     * @return true if provider is healthy and available
     */
    boolean isAvailable();

    /**
     * Get k-line data.
     *
     * @param symbol    the stock symbol
     * @param timeframe the timeframe (e.g., "1m", "5m", "1h", "1d")
     * @param limit     maximum number of records to return
     * @param startTime optional start time filter
     * @param endTime   optional end time filter
     * @return list of k-line data
     * @throws MarketDataException if data fetch fails
     */
    List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                  Instant startTime, Instant endTime)
            throws MarketDataException;

    /**
     * Get real-time tick data.
     *
     * @param symbol the stock symbol
     * @return optional tick data
     * @throws MarketDataException if data fetch fails
     */
    Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException;

    /**
     * Subscribe to real-time data for symbols.
     *
     * @param symbols  list of symbols to subscribe
     * @param callback callback for data updates
     * @throws MarketDataException if subscription fails
     */
    void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback)
            throws MarketDataException;

    /**
     * Unsubscribe from real-time data.
     *
     * @param symbols list of symbols to unsubscribe
     */
    void unsubscribeRealTime(List<String> symbols);

    /**
     * Get current market status.
     *
     * @return MarketStatus indicating if market is open, closed, etc.
     */
    MarketStatus getMarketStatus();

    /**
     * Search for symbols.
     *
     * @param keyword search keyword
     * @param limit   maximum results
     * @return list of matching symbols
     */
    List<SymbolInfo> searchSymbols(String keyword, int limit);

    /**
     * Get provider health score (0-100).
     *
     * @return health score
     */
    default int getHealthScore() {
        return isAvailable() ? MAX_HEALTH_SCORE : MIN_HEALTH_SCORE;
    }

    /**
     * Callback interface for real-time data.
     */
    @FunctionalInterface
    interface RealTimeDataCallback {
        void onDataUpdate(TickData tickData);

        default void onError(Throwable error) {
            // Default no-op error handler
        }
    }

    /**
     * Market status enum.
     */
    enum MarketStatus {
        /** Market is open for trading. */
        OPEN,
        /** Market is closed. */
        CLOSED,
        /** Pre-market trading session. */
        PRE_MARKET,
        /** Post-market trading session. */
        POST_MARKET,
        /** Market is on break. */
        BREAK,
        /** Market status is unknown. */
        UNKNOWN
    }

    /**
     * Symbol information record.
     *
     * @param symbol   the stock symbol
     * @param name     the stock name
     * @param market   the market type
     * @param exchange the exchange code
     * @param type     the security type
     */
    record SymbolInfo(
            String symbol,
            String name,
            String market,
            String exchange,
            String type
    ) {
    }

    /**
     * Exception for market data errors.
     */
    class MarketDataException extends Exception {
        private static final long serialVersionUID = 1L;

        /**
         * Constructs a new MarketDataException with the specified message.
         *
         * @param message the error message
         */
        public MarketDataException(String message) {
            super(message);
        }

        /**
         * Constructs a new MarketDataException with the specified message and cause.
         *
         * @param message the error message
         * @param cause   the underlying cause
         */
        public MarketDataException(String message, Throwable cause) {
            super(message, cause);
        }

        /**
         * Constructs a new MarketDataException with the specified cause.
         *
         * @param cause the underlying cause
         */
        public MarketDataException(Throwable cause) {
            super(cause);
        }
    }
}
