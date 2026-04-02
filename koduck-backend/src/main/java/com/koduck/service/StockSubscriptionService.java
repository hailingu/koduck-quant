package com.koduck.service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
    void onPriceUpdate(PriceUpdate priceUpdate);

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
     * Message containing price update data.
     */
    class PriceUpdateMessage {
        /** The message type. */
        private String type;

        /** The message timestamp. */
        private String timestamp;

        /** The price data. */
        private PriceData data;

        /**
         * Price data in the message.
         */
        public static class PriceData {
            /** The stock symbol. */
            private String symbol;

            /** The stock name. */
            private String name;

            /** The current price. */
            private Double price;

            /** The price change. */
            private Double change;

            /** The price change percentage. */
            private Double changePercent;

            /** The trading volume. */
            private Long volume;

            /**
             * Get the symbol.
             *
             * @return the symbol
             */
            public String getSymbol() {
                return symbol;
            }

            /**
             * Set the symbol.
             *
             * @param symbol the symbol
             */
            public void setSymbol(String symbol) {
                this.symbol = symbol;
            }

            /**
             * Get the name.
             *
             * @return the name
             */
            public String getName() {
                return name;
            }

            /**
             * Set the name.
             *
             * @param name the name
             */
            public void setName(String name) {
                this.name = name;
            }

            /**
             * Get the price.
             *
             * @return the price
             */
            public Double getPrice() {
                return price;
            }

            /**
             * Set the price.
             *
             * @param price the price
             */
            public void setPrice(Double price) {
                this.price = price;
            }

            /**
             * Get the change.
             *
             * @return the change
             */
            public Double getChange() {
                return change;
            }

            /**
             * Set the change.
             *
             * @param change the change
             */
            public void setChange(Double change) {
                this.change = change;
            }

            /**
             * Get the change percentage.
             *
             * @return the change percentage
             */
            public Double getChangePercent() {
                return changePercent;
            }

            /**
             * Set the change percentage.
             *
             * @param changePercent the change percentage
             */
            public void setChangePercent(Double changePercent) {
                this.changePercent = changePercent;
            }

            /**
             * Get the volume.
             *
             * @return the volume
             */
            public Long getVolume() {
                return volume;
            }

            /**
             * Set the volume.
             *
             * @param volume the volume
             */
            public void setVolume(Long volume) {
                this.volume = volume;
            }

            /**
             * Create a copy of this PriceData.
             *
             * @return a deep copy
             */
            private PriceData copy() {
                PriceData copy = new PriceData();
                copy.setSymbol(symbol);
                copy.setName(name);
                copy.setPrice(price);
                copy.setChange(change);
                copy.setChangePercent(changePercent);
                copy.setVolume(volume);
                return copy;
            }
        }

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
         * @return the price data
         */
        public PriceData getData() {
            return data == null ? null : data.copy();
        }

        /**
         * Set the price data.
         *
         * @param data the price data
         */
        public void setData(PriceData data) {
            this.data = data == null ? null : data.copy();
        }
    }

    /**
     * Price update event data (used for internal processing).
     */
    class PriceUpdate {
        /** The stock symbol. */
        private String symbol;

        /** The stock name. */
        private String name;

        /** The current price. */
        private Double price;

        /** The price change. */
        private Double change;

        /** The price change percentage. */
        private Double changePercent;

        /** The trading volume. */
        private Long volume;

        /**
         * Default constructor.
         */
        public PriceUpdate() {
        }

        /**
         * Constructs a PriceUpdate with all fields.
         *
         * @param symbol        the stock symbol
         * @param name          the stock name
         * @param price         the current price
         * @param change        the price change
         * @param changePercent the price change percentage
         * @param volume        the trading volume
         */
        public PriceUpdate(String symbol, String name, Double price, Double change, Double changePercent, Long volume) {
            this.symbol = symbol;
            this.name = name;
            this.price = price;
            this.change = change;
            this.changePercent = changePercent;
            this.volume = volume;
        }

        /**
         * Get the symbol.
         *
         * @return the symbol
         */
        public String getSymbol() {
            return symbol;
        }

        /**
         * Set the symbol.
         *
         * @param symbol the symbol
         */
        public void setSymbol(String symbol) {
            this.symbol = symbol;
        }

        /**
         * Get the name.
         *
         * @return the name
         */
        public String getName() {
            return name;
        }

        /**
         * Set the name.
         *
         * @param name the name
         */
        public void setName(String name) {
            this.name = name;
        }

        /**
         * Get the price.
         *
         * @return the price
         */
        public Double getPrice() {
            return price;
        }

        /**
         * Set the price.
         *
         * @param price the price
         */
        public void setPrice(Double price) {
            this.price = price;
        }

        /**
         * Get the change.
         *
         * @return the change
         */
        public Double getChange() {
            return change;
        }

        /**
         * Set the change.
         *
         * @param change the change
         */
        public void setChange(Double change) {
            this.change = change;
        }

        /**
         * Get the change percentage.
         *
         * @return the change percentage
         */
        public Double getChangePercent() {
            return changePercent;
        }

        /**
         * Set the change percentage.
         *
         * @param changePercent the change percentage
         */
        public void setChangePercent(Double changePercent) {
            this.changePercent = changePercent;
        }

        /**
         * Get the volume.
         *
         * @return the volume
         */
        public Long getVolume() {
            return volume;
        }

        /**
         * Set the volume.
         *
         * @param volume the volume
         */
        public void setVolume(Long volume) {
            this.volume = volume;
        }

        /**
         * Create a new builder.
         *
         * @return a new PriceUpdateBuilder
         */
        public static PriceUpdateBuilder builder() {
            return new PriceUpdateBuilder();
        }

        /**
         * Builder for PriceUpdate.
         */
        public static class PriceUpdateBuilder {
            /** The stock symbol. */
            private String symbol;

            /** The stock name. */
            private String name;

            /** The current price. */
            private Double price;

            /** The price change. */
            private Double change;

            /** The price change percentage. */
            private Double changePercent;

            /** The trading volume. */
            private Long volume;

            /**
             * Set the symbol.
             *
             * @param symbol the symbol
             * @return this builder
             */
            public PriceUpdateBuilder symbol(String symbol) {
                this.symbol = symbol;
                return this;
            }

            /**
             * Set the name.
             *
             * @param name the name
             * @return this builder
             */
            public PriceUpdateBuilder name(String name) {
                this.name = name;
                return this;
            }

            /**
             * Set the price.
             *
             * @param price the price
             * @return this builder
             */
            public PriceUpdateBuilder price(Double price) {
                this.price = price;
                return this;
            }

            /**
             * Set the change.
             *
             * @param change the change
             * @return this builder
             */
            public PriceUpdateBuilder change(Double change) {
                this.change = change;
                return this;
            }

            /**
             * Set the change percentage.
             *
             * @param changePercent the change percentage
             * @return this builder
             */
            public PriceUpdateBuilder changePercent(Double changePercent) {
                this.changePercent = changePercent;
                return this;
            }

            /**
             * Set the volume.
             *
             * @param volume the volume
             * @return this builder
             */
            public PriceUpdateBuilder volume(Long volume) {
                this.volume = volume;
                return this;
            }

            /**
             * Build the PriceUpdate.
             *
             * @return a new PriceUpdate instance
             */
            public PriceUpdate build() {
                return new PriceUpdate(symbol, name, price, change, changePercent, volume);
            }
        }
    }
}
