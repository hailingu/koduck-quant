package com.koduck.dto.websocket;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket subscription message DTO.
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /** Message type: SUBSCRIBE / UNSUBSCRIBE. */
    private String type;

    /** List of stock symbols to subscribe. */
    private List<String> symbols;

    /** List of successfully subscribed stock symbols. */
    private List<String> success;

    /** Mapping of failed subscriptions to their reasons. */
    private Map<String, String> failed;

    /** List of all currently subscribed stock symbols. */
    private List<String> subscriptions;

    /** Message timestamp. */
    private Long timestamp;

    /**
     * Constructs a SubscriptionMessage.
     *
     * @param type          the message type
     * @param symbols       the list of stock symbols to subscribe
     * @param success       the list of successfully subscribed symbols
     * @param failed        the mapping of failed subscriptions to reasons
     * @param subscriptions the list of all currently subscribed symbols
     * @param timestamp     the message timestamp
     */
    public SubscriptionMessage(String type, List<String> symbols, List<String> success,
                               Map<String, String> failed, List<String> subscriptions,
                               Long timestamp) {
        this.type = type;
        this.symbols = CollectionCopyUtils.copyList(symbols);
        this.success = CollectionCopyUtils.copyList(success);
        this.failed = CollectionCopyUtils.copyMap(failed);
        this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
        this.timestamp = timestamp;
    }

    /**
     * Creates a new Builder instance.
     *
     * @return a Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Subscription message builder.
     */
    public static final class Builder {

        /** The message type. */
        private String type;

        /** The list of stock symbols to subscribe. */
        private List<String> symbols;

        /** The list of successfully subscribed stock symbols. */
        private List<String> success;

        /** The mapping of failed subscriptions to their reasons. */
        private Map<String, String> failed;

        /** The list of all currently subscribed stock symbols. */
        private List<String> subscriptions;

        /** The message timestamp. */
        private Long timestamp;

        /**
         * Sets the message type.
         *
         * @param type the message type
         * @return this Builder instance
         */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /**
         * Sets the list of stock symbols to subscribe.
         *
         * @param symbols the list of stock symbols
         * @return this Builder instance
         */
        public Builder symbols(List<String> symbols) {
            this.symbols = CollectionCopyUtils.copyList(symbols);
            return this;
        }

        /**
         * Sets the list of successfully subscribed stock symbols.
         *
         * @param success the list of successful symbols
         * @return this Builder instance
         */
        public Builder success(List<String> success) {
            this.success = CollectionCopyUtils.copyList(success);
            return this;
        }

        /**
         * Sets the mapping of failed subscriptions to their reasons.
         *
         * @param failed the mapping of failures
         * @return this Builder instance
         */
        public Builder failed(Map<String, String> failed) {
            this.failed = CollectionCopyUtils.copyMap(failed);
            return this;
        }

        /**
         * Sets the list of all currently subscribed stock symbols.
         *
         * @param subscriptions the list of subscriptions
         * @return this Builder instance
         */
        public Builder subscriptions(List<String> subscriptions) {
            this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
            return this;
        }

        /**
         * Sets the message timestamp.
         *
         * @param timestamp the timestamp
         * @return this Builder instance
         */
        public Builder timestamp(Long timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Builds a SubscriptionMessage instance.
         *
         * @return a SubscriptionMessage instance
         */
        public SubscriptionMessage build() {
            return new SubscriptionMessage(type, symbols, success, failed, subscriptions, timestamp);
        }
    }

    /**
     * Gets a copy of the stock symbols list.
     *
     * @return a copy of the symbols list
     */
    public List<String> getSymbols() {
        return CollectionCopyUtils.copyList(symbols);
    }

    /**
     * Sets the stock symbols list.
     *
     * @param symbols the list of stock symbols
     */
    public void setSymbols(List<String> symbols) {
        this.symbols = CollectionCopyUtils.copyList(symbols);
    }

    /**
     * Gets a copy of the successfully subscribed stock symbols list.
     *
     * @return a copy of the successful symbols list
     */
    public List<String> getSuccess() {
        return CollectionCopyUtils.copyList(success);
    }

    /**
     * Sets the successfully subscribed stock symbols list.
     *
     * @param success the list of successful symbols
     */
    public void setSuccess(List<String> success) {
        this.success = CollectionCopyUtils.copyList(success);
    }

    /**
     * Gets a copy of the failed subscriptions mapping.
     *
     * @return a copy of the failed mapping
     */
    public Map<String, String> getFailed() {
        return CollectionCopyUtils.copyMap(failed);
    }

    /**
     * Sets the failed subscriptions mapping.
     *
     * @param failed the mapping of failures
     */
    public void setFailed(Map<String, String> failed) {
        this.failed = CollectionCopyUtils.copyMap(failed);
    }

    /**
     * Gets a copy of the currently subscribed stock symbols list.
     *
     * @return a copy of the subscriptions list
     */
    public List<String> getSubscriptions() {
        return CollectionCopyUtils.copyList(subscriptions);
    }

    /**
     * Sets the currently subscribed stock symbols list.
     *
     * @param subscriptions the list of subscriptions
     */
    public void setSubscriptions(List<String> subscriptions) {
        this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
    }
}
