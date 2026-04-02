package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

import java.util.List;
import java.util.Map;

/**
 * WebSocket 订阅消息 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /** 消息类型：SUBSCRIBE / UNSUBSCRIBE。 */
    private String type;

    /** 要订阅的股票代码列表。 */
    private List<String> symbols;

    /** 订阅成功的股票代码列表。 */
    private List<String> success;

    /** 订阅失败的股票代码及原因映射。 */
    private Map<String, String> failed;

    /** 当前所有订阅的股票代码列表。 */
    private List<String> subscriptions;

    /** 消息时间戳。 */
    private Long timestamp;

    /**
     * 构造方法。
     *
     * @param type          消息类型
     * @param symbols       要订阅的股票代码列表
     * @param success       订阅成功的股票代码列表
     * @param failed        订阅失败的股票代码及原因映射
     * @param subscriptions 当前所有订阅的股票代码列表
     * @param timestamp     消息时间戳
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
     * 创建 Builder 实例。
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

        /** 订阅成功的股票代码列表。 */
        private List<String> success;

        /** 订阅失败的股票代码及原因映射。 */
        private Map<String, String> failed;

        /** 当前所有订阅的股票代码列表。 */
        private List<String> subscriptions;

        /** 消息时间戳。 */
        private Long timestamp;

        /**
         * 设置消息类型。
         *
         * @param type 消息类型
         * @return Builder 实例
         */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /**
         * 设置要订阅的股票代码列表。
         *
         * @param symbols 股票代码列表
         * @return Builder 实例
         */
        public Builder symbols(List<String> symbols) {
            this.symbols = CollectionCopyUtils.copyList(symbols);
            return this;
        }

        /**
         * 设置订阅成功的股票代码列表。
         *
         * @param success 成功的股票代码列表
         * @return Builder 实例
         */
        public Builder success(List<String> success) {
            this.success = CollectionCopyUtils.copyList(success);
            return this;
        }

        /**
         * 设置订阅失败的股票代码及原因映射。
         *
         * @param failed 失败映射
         * @return Builder 实例
         */
        public Builder failed(Map<String, String> failed) {
            this.failed = CollectionCopyUtils.copyMap(failed);
            return this;
        }

        /**
         * 设置当前所有订阅的股票代码列表。
         *
         * @param subscriptions 订阅列表
         * @return Builder 实例
         */
        public Builder subscriptions(List<String> subscriptions) {
            this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
            return this;
        }

        /**
         * 设置消息时间戳。
         *
         * @param timestamp 时间戳
         * @return Builder 实例
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
     * 获取股票代码列表的副本。
     *
     * @return 股票代码列表副本
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
     * 获取订阅成功的股票代码列表副本。
     *
     * @return 成功的股票代码列表副本
     */
    public List<String> getSuccess() {
        return CollectionCopyUtils.copyList(success);
    }

    /**
     * 设置订阅成功的股票代码列表。
     *
     * @param success 成功的股票代码列表
     */
    public void setSuccess(List<String> success) {
        this.success = CollectionCopyUtils.copyList(success);
    }

    /**
     * 获取订阅失败的股票代码及原因映射副本。
     *
     * @return 失败的映射副本
     */
    public Map<String, String> getFailed() {
        return CollectionCopyUtils.copyMap(failed);
    }

    /**
     * 设置订阅失败的股票代码及原因映射。
     *
     * @param failed 失败的映射
     */
    public void setFailed(Map<String, String> failed) {
        this.failed = CollectionCopyUtils.copyMap(failed);
    }

    /**
     * 获取当前所有订阅的股票代码列表副本。
     *
     * @return 订阅列表副本
     */
    public List<String> getSubscriptions() {
        return CollectionCopyUtils.copyList(subscriptions);
    }

    /**
     * 设置当前所有订阅的股票代码列表。
     *
     * @param subscriptions 订阅列表
     */
    public void setSubscriptions(List<String> subscriptions) {
        this.subscriptions = CollectionCopyUtils.copyList(subscriptions);
    }
}
