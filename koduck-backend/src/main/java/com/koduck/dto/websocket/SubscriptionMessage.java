package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Singular;

import java.util.List;
import java.util.Map;

/**
 * WebSocket 
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /**
     *  SUBSCRIBE / UNSUBSCRIBE
     */
    private String type;

    /**
     * 
     */
    @Singular
    private List<String> symbols;

    /**
     * 
     */
    @Singular("successItem")
    private List<String> success;

    /**
     * 
     */
    @Singular("failedEntry")
    private Map<String, String> failed;

    /**
     * 
     */
    @Singular
    private List<String> subscriptions;

    /**
     * 
     */
    private Long timestamp;

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
