package com.koduck.dto.websocket;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 订阅消息数据传输对象。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /** 消息类型：订阅 / 取消订阅。 */
    private String type;

    /** 要订阅的股票代码列表。 */
    private List<String> symbols;

    /** 成功订阅的股票代码列表。 */
    private List<String> success;

    /** 失败订阅到原因的映射。 */
    private Map<String, String> failed;

    /** 所有当前订阅的股票代码列表。 */
    private List<String> subscriptions;

    /** 消息时间戳。 */
    private Long timestamp;

    /**
     * 构造 SubscriptionMessage。
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
     * 创建新的 Builder 实例。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * 订阅消息构建器。
     */
    public static final class Builder {
        /** 消息类型。 */
        private String type;
        /** 要订阅的股票代码列表。 */
        private List<String> symbols;
        /** 成功订阅的股票代码列表。 */
        private List<String> success;
        /** 失败订阅到原因的映射。 */
        private Map<String, String> failed;
        /** 所有当前订阅的股票代码列表。 */
        private List<String> subscriptions;
        /** 消息时间戳。 */
        private Long timestamp;

        /**
 * 设置消息类型。
         *
         * @param type 消息类型
         * @return this Builder instance
         */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /**
 * 设置要订阅的股票代码列表。
         *
         * @param symbols 股票代码列表
         * @return this Builder instance
         */
        public Builder symbols(List<String> symbols) {
            this.symbols = CollectionCopyUtils.copyList(symbols);
            return this;
        }

        /**
 * 设置成功订阅的股票代码列表。
         *
         * @param success 成功订阅的股票代码列表
         * @return this Builder instance
         */
        public Builder success(List<String> success) {
            this.success = CollectionCopyUtils.copyList(success);
            return this;
        }

        /**
 * 设置失败订阅到原因的映射。
         *
         * @param failed 失败映射
         * @return this Builder instance
         */
        public Builder failed(Map<String, String> failed) {
            this.failed = CollectionCopyUtils.copyMap(failed);
            return this;
        }

        /**
 * 设置所有当前订阅的股票代码列表。
         *
         * @param subscriptions 订阅列表
         * @return this Builder instance
         */
        public Builder subscriptions(List<String> subscriptions) {
            this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
            return this;
        }

        /**
 * 设置消息时间戳。
         *
         * @param timestamp 时间戳
         * @return this Builder instance
         */
        public Builder timestamp(Long timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
 * 构建 SubscriptionMessage 实例。
         *
         * @return SubscriptionMessage 实例
         */
        public SubscriptionMessage build() {
            return new SubscriptionMessage(type, symbols, success, failed, subscriptions, timestamp);
        }
    }

    /**
 * 获取股票代码列表的拷贝。
     *
     * @return 股票代码列表的拷贝
     */
    public List<String> getSymbols() {
        return CollectionCopyUtils.copyList(symbols);
    }

    /**
 * 设置股票代码列表。
     *
     * @param symbols 股票代码列表
     */
    public void setSymbols(List<String> symbols) {
        this.symbols = CollectionCopyUtils.copyList(symbols);
    }

    /**
 * 获取成功订阅的股票代码列表的拷贝。
     *
     * @return 成功订阅的股票代码列表的拷贝
     */
    public List<String> getSuccess() {
        return CollectionCopyUtils.copyList(success);
    }

    /**
 * 设置成功订阅的股票代码列表。
     *
     * @param success 成功订阅的股票代码列表
     */
    public void setSuccess(List<String> success) {
        this.success = CollectionCopyUtils.copyList(success);
    }

    /**
 * 获取失败订阅映射的拷贝。
     *
     * @return 失败映射的拷贝
     */
    public Map<String, String> getFailed() {
        return CollectionCopyUtils.copyMap(failed);
    }

    /**
 * 设置失败订阅映射。
     *
     * @param failed 失败映射
     */
    public void setFailed(Map<String, String> failed) {
        this.failed = CollectionCopyUtils.copyMap(failed);
    }

    /**
 * 获取当前订阅的股票代码列表的拷贝。
     *
     * @return 订阅列表的拷贝
     */
    public List<String> getSubscriptions() {
        return CollectionCopyUtils.copyList(subscriptions);
    }

    /**
 * 设置当前订阅的股票代码列表。
     *
     * @param subscriptions 订阅列表
     */
    public void setSubscriptions(List<String> subscriptions) {
        this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
    }
}
