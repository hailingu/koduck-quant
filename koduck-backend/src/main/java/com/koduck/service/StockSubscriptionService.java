package com.koduck.service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.koduck.dto.market.PriceUpdateDto;

/**
 * 用户股票订阅管理服务接口。
 * 提供订阅/取消订阅股票价格更新的功能。
 *
 * <p>使用线程安全的集合（ConcurrentHashMap）管理双向映射：</p>
 * <ul>
 *   <li>用户订阅（userId -> Set&lt;symbol&gt;）</li>
 *   <li>股票订阅者（symbol -> Set&lt;userId&gt;）</li>
 *   <li>实时价格分发</li>
 * </ul>
 *
 * @author Koduck Team
 */
public interface StockSubscriptionService {

    /**
     * 订阅用户到股票代码。
     *
     * @param userId  用户ID
     * @param symbols 要订阅的股票代码列表
     * @return 订阅结果，包含成功和失败的股票代码
     */
    SubscribeResult subscribe(Long userId, List<String> symbols);

    /**
     * 取消订阅用户从股票代码。
     *
     * @param userId  用户ID
     * @param symbols 要取消订阅的股票代码列表
     * @return 订阅结果，包含成功和失败的股票代码
     */
    SubscribeResult unsubscribe(Long userId, List<String> symbols);

    /**
     * 获取某只股票的所有订阅者。
     *
     * @param symbol 股票代码
     * @return 订阅者用户ID集合
     */
    Set<Long> getSubscribers(String symbol);

    /**
     * 获取用户的所有订阅。
     *
     * @param userId 用户ID
     * @return 已订阅的股票代码集合
     */
    Set<String> getUserSubscriptions(Long userId);

    /**
     * 获取所有用户订阅的股票代码。
     *
     * @return 所有已订阅的股票代码集合
     */
    Set<String> getAllSubscribedSymbols();

    /**
     * 处理价格更新事件。
     *
     * @param priceUpdate 价格更新数据
     */
    void onPriceUpdate(PriceUpdateDto priceUpdate);

    /**
     * 处理用户断开连接事件。
     *
     * @param userId 用户ID
     */
    void onUserDisconnect(Long userId);

    /**
     * 订阅/取消订阅操作的结果。
     */
    class SubscribeResult {
        /** 成功处理的股票代码列表。 */
        private final List<String> success;

        /** 失败的股票代码到错误原因的映射。 */
        private final Map<String, String> failed;

        /**
         * 构造SubscribeResult。
         *
         * @param success 成功的股票代码列表
         * @param failed  失败的股票代码到原因的映射
         */
        public SubscribeResult(List<String> success, Map<String, String> failed) {
            this.success = success == null ? List.of() : List.copyOf(success);
            this.failed = failed == null ? Map.of() : Map.copyOf(new HashMap<>(failed));
        }

        /**
         * 获取成功的股票代码列表。
         *
         * @return 成功的股票代码列表
         */
        public List<String> getSuccess() {
            return List.copyOf(success);
        }

        /**
         * 获取失败的股票代码映射。
         *
         * @return 失败的股票代码到原因的映射
         */
        public Map<String, String> getFailed() {
            return Map.copyOf(failed);
        }

        /**
         * 为给定的股票代码创建失败结果。
         *
         * @param symbols 失败的股票代码
         * @param reason  失败原因
         * @return 所有股票代码都标记为失败的SubscribeResult
         */
        public static SubscribeResult failure(List<String> symbols, String reason) {
            Map<String, String> failed = new HashMap<>();
            if (symbols != null) {
                symbols.forEach(s -> failed.put(s, reason));
            }
            return new SubscribeResult(Collections.emptyList(), failed);
        }

        /**
         * 检查是否有失败。
         *
         * @return 如果有失败的股票代码则返回true
         */
        public boolean hasFailures() {
            return !failed.isEmpty();
        }
    }

    /**
     * 包含用于WebSocket传输的价格更新数据的消息。
     */
    class PriceUpdateMessage {
        /** 消息类型。 */
        private String type;

        /** 消息时间戳。 */
        private String timestamp;

        /** 价格数据。 */
        private PriceUpdateDto data;

        /**
         * 获取消息类型。
         *
         * @return 类型
         */
        public String getType() {
            return type;
        }

        /**
         * 设置消息类型。
         *
         * @param type 类型
         */
        public void setType(String type) {
            this.type = type;
        }

        /**
         * 获取时间戳。
         *
         * @return 时间戳
         */
        public String getTimestamp() {
            return timestamp;
        }

        /**
         * 设置时间戳。
         *
         * @param timestamp 时间戳
         */
        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }

        /**
         * 获取价格数据。
         *
         * @return 价格数据（防御性拷贝）
         */
        public PriceUpdateDto getData() {
            if (data == null) {
                return null;
            }
            return PriceUpdateDto.builder()
                    .symbol(data.symbol())
                    .name(data.name())
                    .price(data.price())
                    .change(data.change())
                    .changePercent(data.changePercent())
                    .volume(data.volume())
                    .build();
        }

        /**
         * 设置价格数据。
         *
         * @param data 价格数据
         */
        public void setData(PriceUpdateDto data) {
            this.data = data;
        }
    }
}
