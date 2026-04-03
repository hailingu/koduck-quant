package com.koduck.service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.koduck.dto.market.PriceUpdateDto;

/**
 * Service interface for managing user stock subscriptions.
 * Provides functionality to subscribe/unsubscribe to stock price updates.
 *
 * <p>Manages bidirectional mappings using thread-safe collections (ConcurrentHashMap):</p>
 * <ul>
 *   <li>User subscriptions (userId -> Set&lt;symbol&gt;)</li>
 *   <li>Symbol subscribers (symbol -> Set&lt;userId&gt;)</li>
 *   <li>Real-time price distribution</li>
 * </ul>
 *
 * @author Koduck Team
 */
public interface StockSubscriptionService {

    /**
     * Subscribe a user to stock symbols.
     *
     * @param userId  the user ID
     * @param symbols the list of stock symbols to subscribe
     * @return the subscription result containing success and failed symbols
     */
    SubscribeResult subscribe(Long userId, List<String> symbols);

    /**
     * Unsubscribe a user from stock symbols.
     *
     * @param userId  the user ID
     * @param symbols the list of stock symbols to unsubscribe
     * @return the subscription result containing success and failed symbols
     */
    SubscribeResult unsubscribe(Long userId, List<String> symbols);

    /**
     * Get all subscribers for a symbol.
     *
     * @param symbol the stock symbol
     * @return the set of subscriber user IDs
     */
    Set<Long> getSubscribers(String symbol);

    /**
     * Get all subscriptions for a user.
     *
     * @param userId the user ID
     * @return the set of subscribed symbols
     */
    Set<String> getUserSubscriptions(Long userId);

    /**
     * Get all subscribed symbols across all users.
     *
     * @return the set of all subscribed symbols
     */
    Set<String> getAllSubscribedSymbols();

    /**
     * Handle price update event.
     *
     * @param priceUpdate the price update data
     */
    void onPriceUpdate(PriceUpdateDto priceUpdate);

    /**
     * Handle user disconnection event.
     *
     * @param userId the user ID
     */
    void onUserDisconnect(Long userId);

    /**
     * Result of a subscribe/unsubscribe operation.
     */
    class SubscribeResult {
        /** List of successfully processed symbols. */
        private final List<String> success;

        /** Map of failed symbols to error reasons. */
        private final Map<String, String> failed;

        /**
         * Constructs a SubscribeResult.
         *
         * @param success the list of successful symbols
         * @param failed  the map of failed symbols to reasons
         */
        public SubscribeResult(List<String> success, Map<String, String> failed) {
            this.success = success == null ? List.of() : List.copyOf(success);
            this.failed = failed == null ? Map.of() : Map.copyOf(new HashMap<>(failed));
        }

        /**
         * Get the list of successful symbols.
         *
         * @return the list of successful symbols
         */
        public List<String> getSuccess() {
            return List.copyOf(success);
        }

        /**
         * Get the map of failed symbols.
         *
         * @return the map of failed symbols to reasons
         */
        public Map<String, String> getFailed() {
            return Map.copyOf(failed);
        }

        /**
         * Create a failure result for the given symbols.
         *
         * @param symbols the symbols that failed
         * @param reason  the failure reason
         * @return a SubscribeResult with all symbols marked as failed
         */
        public static SubscribeResult failure(List<String> symbols, String reason) {
            Map<String, String> failed = new HashMap<>();
            if (symbols != null) {
                symbols.forEach(s -> failed.put(s, reason));
            }
            return new SubscribeResult(Collections.emptyList(), failed);
        }

        /**
         * Check if there are any failures.
         *
         * @return true if there are failed symbols
         */
        public boolean hasFailures() {
            return !failed.isEmpty();
        }
    }

    /**
     * Message containing price update data for WebSocket transmission.
     */
    class PriceUpdateMessage {
        /** The message type. */
        private String type;

        /** The message timestamp. */
        private String timestamp;

        /** The price data. */
        private PriceUpdateDto data;

        /**
         * Get the message type.
         *
         * @return the type
         */
        public String getType() {
            return type;
        }

        /**
         * Set the message type.
         *
         * @param type the type
         */
        public void setType(String type) {
            this.type = type;
        }

        /**
         * Get the timestamp.
         *
         * @return the timestamp
         */
        public String getTimestamp() {
            return timestamp;
        }

        /**
         * Set the timestamp.
         *
         * @param timestamp the timestamp
         */
        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }

        /**
         * Get the price data.
         *
         * @return the price data (defensive copy)
         */
        public PriceUpdateDto getData() {
            if (data == null) {
                return null;
            }
            return PriceUpdateDto.builder()
                    .symbol(data.getSymbol())
                    .name(data.getName())
                    .price(data.getPrice())
                    .change(data.getChange())
                    .changePercent(data.getChangePercent())
                    .volume(data.getVolume())
                    .build();
        }

        /**
         * Set the price data.
         *
         * @param data the price data
         */
        public void setData(PriceUpdateDto data) {
            this.data = data;
        }
    }
}
