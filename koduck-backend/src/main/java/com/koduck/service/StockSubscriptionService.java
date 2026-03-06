package com.koduck.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 股票订阅管理服务
 *
 * <p>管理用户的股票订阅关系，并在价格变动时推送更新消息。</p>
 * <p>使用内存存储订阅关系（基于 ConcurrentHashMap），支持：</p>
 * <ul>
 *   <li>用户-股票订阅关系管理（userId -> Set<symbol>）</li>
 *   <li>反向索引（symbol -> Set<userId>）用于快速查找订阅者</li>
 *   <li>用户断开连接时自动清理订阅</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StockSubscriptionService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 存储用户订阅关系: userId -> Set<symbol>
     */
    private final ConcurrentHashMap<Long, Set<String>> userSubscriptions = new ConcurrentHashMap<>();

    /**
     * 反向索引: symbol -> Set<userId>
     */
    private final ConcurrentHashMap<String, Set<Long>> symbolSubscribers = new ConcurrentHashMap<>();

    /**
     * 用户订阅股票
     *
     * @param userId  用户ID
     * @param symbols 股票代码列表
     * @return 订阅结果，包含成功和失败的股票代码
     */
    public SubscribeResult subscribe(Long userId, List<String> symbols) {
        if (userId == null || symbols == null || symbols.isEmpty()) {
            return SubscribeResult.failure(symbols, "Invalid parameters");
        }

        Set<String> userSubList = userSubscriptions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet());
        List<String> successList = new ArrayList<>();
        Map<String, String> failedMap = new HashMap<>();

        for (String symbol : symbols) {
            try {
                String normalizedSymbol = normalizeSymbol(symbol);
                if (normalizedSymbol == null) {
                    failedMap.put(symbol, "Invalid symbol format");
                    continue;
                }

                // 添加到用户订阅列表
                userSubList.add(normalizedSymbol);

                // 添加到反向索引
                symbolSubscribers.computeIfAbsent(normalizedSymbol, k -> ConcurrentHashMap.newKeySet())
                        .add(userId);

                successList.add(normalizedSymbol);
                log.debug("User {} subscribed to stock {}", userId, normalizedSymbol);
            } catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to subscribe user {} to stock {}: {}", userId, symbol, e.getMessage());
            }
        }

        log.info("User {} subscription result: success={}, failed={}", userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }

    /**
     * 用户取消订阅股票
     *
     * @param userId  用户ID
     * @param symbols 股票代码列表
     * @return 取消订阅结果
     */
    public SubscribeResult unsubscribe(Long userId, List<String> symbols) {
        if (userId == null) {
            return SubscribeResult.failure(symbols != null ? symbols : Collections.emptyList(), "Invalid userId");
        }

        if (symbols == null || symbols.isEmpty()) {
            // 取消该用户所有订阅
            Set<String> userSubList = userSubscriptions.remove(userId);
            if (userSubList != null) {
                for (String symbol : userSubList) {
                    Set<Long> subscribers = symbolSubscribers.get(symbol);
                    if (subscribers != null) {
                        subscribers.remove(userId);
                        if (subscribers.isEmpty()) {
                            symbolSubscribers.remove(symbol);
                        }
                    }
                }
            }
            log.info("User {} unsubscribed from all stocks", userId);
            return new SubscribeResult(new ArrayList<>(userSubList), Collections.emptyMap());
        }

        Set<String> userSubList = userSubscriptions.get(userId);
        List<String> successList = new ArrayList<>();
        Map<String, String> failedMap = new HashMap<>();

        if (userSubList == null || userSubList.isEmpty()) {
            return SubscribeResult.failure(symbols, "No subscriptions found");
        }

        for (String symbol : symbols) {
            try {
                String normalizedSymbol = normalizeSymbol(symbol);
                if (normalizedSymbol == null) {
                    failedMap.put(symbol, "Invalid symbol format");
                    continue;
                }

                // 从用户订阅列表中移除
                userSubList.remove(normalizedSymbol);

                // 从反向索引中移除
                Set<Long> subscribers = symbolSubscribers.get(normalizedSymbol);
                if (subscribers != null) {
                    subscribers.remove(userId);
                    if (subscribers.isEmpty()) {
                        symbolSubscribers.remove(normalizedSymbol);
                    }
                }

                successList.add(normalizedSymbol);
                log.debug("User {} unsubscribed from stock {}", userId, normalizedSymbol);
            } catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to unsubscribe user {} from stock {}: {}", userId, symbol, e.getMessage());
            }
        }

        // 如果用户订阅列表为空，移除该用户
        if (userSubList.isEmpty()) {
            userSubscriptions.remove(userId);
        }

        log.info("User {} unsubscription result: success={}, failed={}", userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }

    /**
     * 获取关注某股票的所有用户ID
     *
     * @param symbol 股票代码
     * @return 订阅该股票的用户ID集合
     */
    public Set<Long> getSubscribers(String symbol) {
        if (symbol == null) {
            return Collections.emptySet();
        }
        String normalizedSymbol = normalizeSymbol(symbol);
        if (normalizedSymbol == null) {
            return Collections.emptySet();
        }
        return symbolSubscribers.getOrDefault(normalizedSymbol, Collections.emptySet());
    }

    /**
     * 获取用户的所有订阅
     *
     * @param userId 用户ID
     * @return 订阅的股票代码集合
     */
    public Set<String> getUserSubscriptions(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }
        Set<String> subscriptions = userSubscriptions.get(userId);
        return subscriptions != null ? new HashSet<>(subscriptions) : Collections.emptySet();
    }

    /**
     * 获取所有被订阅的股票代码
     *
     * @return 所有被订阅的股票代码集合
     */
    public Set<String> getAllSubscribedSymbols() {
        return new HashSet<>(symbolSubscribers.keySet());
    }

    /**
     * 处理价格更新消息，推送给所有关注该股票的用户
     *
     * @param priceUpdate 价格更新数据
     */
    public void onPriceUpdate(PriceUpdate priceUpdate) {
        if (priceUpdate == null || priceUpdate.getSymbol() == null) {
            log.warn("Invalid price update: {}", priceUpdate);
            return;
        }

        String symbol = normalizeSymbol(priceUpdate.getSymbol());
        if (symbol == null) {
            log.warn("Invalid symbol in price update: {}", priceUpdate.getSymbol());
            return;
        }

        Set<Long> subscribers = getSubscribers(symbol);
        if (subscribers.isEmpty()) {
            log.debug("No subscribers for symbol {}", symbol);
            return;
        }

        // 构建消息
        PriceUpdateMessage message = PriceUpdateMessage.builder()
                .type("PRICE_UPDATE")
                .timestamp(Instant.now().toString())
                .data(PriceUpdateMessage.PriceData.builder()
                        .symbol(priceUpdate.getSymbol())
                        .name(priceUpdate.getName())
                        .price(priceUpdate.getPrice())
                        .change(priceUpdate.getChange())
                        .changePercent(priceUpdate.getChangePercent())
                        .volume(priceUpdate.getVolume())
                        .build())
                .build();

        // 推送给所有订阅者
        for (Long userId : subscribers) {
            try {
                // 使用 /queue/user/<userId>/price 主题进行私有推送
                messagingTemplate.convertAndSendToUser(
                        userId.toString(),
                        "/queue/price",
                        message
                );
                log.debug("Sent price update for {} to user {}", symbol, userId);
            } catch (Exception e) {
                log.error("Failed to send price update to user {}: {}", userId, e.getMessage());
            }
        }

        log.info("Price update for {} sent to {} subscribers", symbol, subscribers.size());
    }

    /**
     * 用户断开连接时清理订阅
     *
     * @param userId 用户ID
     */
    public void onUserDisconnect(Long userId) {
        if (userId == null) {
            return;
        }

        // 移除用户的所有订阅
        unsubscribe(userId, Collections.emptyList());
        log.info("Cleaned up subscriptions for disconnected user {}", userId);
    }

    /**
     * 规范化股票代码格式
     *
     * @param symbol 原始股票代码
     * @return 规范化后的股票代码
     */
    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return null;
        }
        // 转换为大写并去除空格
        return symbol.trim().toUpperCase();
    }

    /**
     * 订阅结果
     */
    public static class SubscribeResult {
        private final List<String> success;
        private final Map<String, String> failed;

        public SubscribeResult(List<String> success, Map<String, String> failed) {
            this.success = success;
            this.failed = failed;
        }

        public static SubscribeResult failure(List<String> symbols, String reason) {
            Map<String, String> failed = new HashMap<>();
            if (symbols != null) {
                symbols.forEach(s -> failed.put(s, reason));
            }
            return new SubscribeResult(Collections.emptyList(), failed);
        }

        public List<String> getSuccess() {
            return success;
        }

        public Map<String, String> getFailed() {
            return failed;
        }

        public boolean hasFailures() {
            return !failed.isEmpty();
        }
    }

    /**
     * 价格更新消息
     */
    public static class PriceUpdateMessage {
        private String type;
        private String timestamp;
        private PriceData data;

        @lombok.Builder
        @lombok.Data
        public static class PriceData {
            private String symbol;
            private String name;
            private Double price;
            private Double change;
            private Double changePercent;
            private Long volume;
        }

        // Getters and setters
        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }

        public PriceData getData() {
            return data;
        }

        public void setData(PriceData data) {
            this.data = data;
        }

        public static PriceUpdateMessageBuilder builder() {
            return new PriceUpdateMessageBuilder();
        }

        public static class PriceUpdateMessageBuilder {
            private String type = "PRICE_UPDATE";
            private String timestamp;
            private PriceData data;

            public PriceUpdateMessageBuilder type(String type) {
                this.type = type;
                return this;
            }

            public PriceUpdateMessageBuilder timestamp(String timestamp) {
                this.timestamp = timestamp;
                return this;
            }

            public PriceUpdateMessageBuilder data(PriceData data) {
                this.data = data;
                return this;
            }

            public PriceUpdateMessage build() {
                PriceUpdateMessage message = new PriceUpdateMessage();
                message.type = this.type;
                message.timestamp = this.timestamp;
                message.data = this.data;
                return message;
            }
        }
    }

    /**
     * 价格更新数据（用于服务内部）
     */
    public static class PriceUpdate {
        private String symbol;
        private String name;
        private Double price;
        private Double change;
        private Double changePercent;
        private Long volume;

        public PriceUpdate() {
        }

        public PriceUpdate(String symbol, String name, Double price, Double change, Double changePercent, Long volume) {
            this.symbol = symbol;
            this.name = name;
            this.price = price;
            this.change = change;
            this.changePercent = changePercent;
            this.volume = volume;
        }

        public String getSymbol() {
            return symbol;
        }

        public void setSymbol(String symbol) {
            this.symbol = symbol;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Double getPrice() {
            return price;
        }

        public void setPrice(Double price) {
            this.price = price;
        }

        public Double getChange() {
            return change;
        }

        public void setChange(Double change) {
            this.change = change;
        }

        public Double getChangePercent() {
            return changePercent;
        }

        public void setChangePercent(Double changePercent) {
            this.changePercent = changePercent;
        }

        public Long getVolume() {
            return volume;
        }

        public void setVolume(Long volume) {
            this.volume = volume;
        }

        public static PriceUpdateBuilder builder() {
            return new PriceUpdateBuilder();
        }

        public static class PriceUpdateBuilder {
            private String symbol;
            private String name;
            private Double price;
            private Double change;
            private Double changePercent;
            private Long volume;

            public PriceUpdateBuilder symbol(String symbol) {
                this.symbol = symbol;
                return this;
            }

            public PriceUpdateBuilder name(String name) {
                this.name = name;
                return this;
            }

            public PriceUpdateBuilder price(Double price) {
                this.price = price;
                return this;
            }

            public PriceUpdateBuilder change(Double change) {
                this.change = change;
                return this;
            }

            public PriceUpdateBuilder changePercent(Double changePercent) {
                this.changePercent = changePercent;
                return this;
            }

            public PriceUpdateBuilder volume(Long volume) {
                this.volume = volume;
                return this;
            }

            public PriceUpdate build() {
                return new PriceUpdate(symbol, name, price, change, changePercent, volume);
            }
        }
    }
}
