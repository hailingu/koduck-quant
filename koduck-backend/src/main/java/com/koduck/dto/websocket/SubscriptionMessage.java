package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * WebSocket 
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /**
     *  SUBSCRIBE / UNSUBSCRIBE
     */
    private String type;

    /**
     * 
     */
    private List<String> symbols;

    /**
     * 
     */
    private List<String> success;

    /**
     * 
     */
    private Map<String, String> failed;

    /**
     * 
     */
    private List<String> subscriptions;

    /**
     * 
     */
    private Long timestamp;

    public SubscriptionMessage(String type, List<String> symbols, List<String> success, Map<String, String> failed,
                               List<String> subscriptions, Long timestamp) {
        this.type = type;
        this.symbols = CollectionCopyUtils.copyList(symbols);
        this.success = CollectionCopyUtils.copyList(success);
        this.failed = CollectionCopyUtils.copyMap(failed);
        this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
        this.timestamp = timestamp;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String type;
        private List<String> symbols;
        private List<String> success;
        private Map<String, String> failed;
        private List<String> subscriptions;
        private Long timestamp;

        public Builder type(String type) { this.type = type; return this; }
        public Builder symbols(List<String> symbols) { this.symbols = CollectionCopyUtils.copyList(symbols); return this; }
        public Builder success(List<String> success) { this.success = CollectionCopyUtils.copyList(success); return this; }
        public Builder failed(Map<String, String> failed) { this.failed = CollectionCopyUtils.copyMap(failed); return this; }
        public Builder subscriptions(List<String> subscriptions) { this.subscriptions = CollectionCopyUtils.copyList(subscriptions); return this; }
        public Builder timestamp(Long timestamp) { this.timestamp = timestamp; return this; }

        public SubscriptionMessage build() {
            return new SubscriptionMessage(type, symbols, success, failed, subscriptions, timestamp);
        }
    }

    public List<String> getSymbols() {
        return CollectionCopyUtils.copyList(symbols);
    }

    public void setSymbols(List<String> symbols) {
        this.symbols = CollectionCopyUtils.copyList(symbols);
    }

    public List<String> getSuccess() {
        return CollectionCopyUtils.copyList(success);
    }

    public void setSuccess(List<String> success) {
        this.success = CollectionCopyUtils.copyList(success);
    }

    public Map<String, String> getFailed() {
        return CollectionCopyUtils.copyMap(failed);
    }

    public void setFailed(Map<String, String> failed) {
        this.failed = CollectionCopyUtils.copyMap(failed);
    }

    public List<String> getSubscriptions() {
        return CollectionCopyUtils.copyList(subscriptions);
    }

    public void setSubscriptions(List<String> subscriptions) {
        this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
    }
}
