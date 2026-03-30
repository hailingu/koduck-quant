package com.koduck.service;

import java.util.List;
import java.util.Map;
import java.util.Collections;
import java.util.Set;

/**
 * 
 *
 * <p>，</p>
 * <p>（ ConcurrentHashMap），：</p>
 * <ul>
 *   <li>-（userId -> Set<symbol>）</li>
 *   <li>（symbol -> Set<userId>）</li>
 *   <li></li>
 * </ul>
 */
public interface StockSubscriptionService {

    /**
     * 
     *
     * @param userId  ID
     * @param symbols 
     * @return ，
     */
    SubscribeResult subscribe(Long userId, List<String> symbols);

    /**
     * 
     *
     * @param userId  ID
     * @param symbols 
     * @return 
     */
    SubscribeResult unsubscribe(Long userId, List<String> symbols);

    /**
     * ID
     *
     * @param symbol 
     * @return ID
     */
    Set<Long> getSubscribers(String symbol);

    /**
     * 
     *
     * @param userId ID
     * @return 
     */
    Set<String> getUserSubscriptions(Long userId);

    /**
     * 
     *
     * @return 
     */
    Set<String> getAllSubscribedSymbols();

    /**
     * ，
     *
     * @param priceUpdate 
     */
    void onPriceUpdate(PriceUpdate priceUpdate);

    /**
     * 
     *
     * @param userId ID
     */
    void onUserDisconnect(Long userId);

    /**
     * 
     */
    class SubscribeResult {
        private final List<String> success;
        private final Map<String, String> failed;

        public SubscribeResult(List<String> success, Map<String, String> failed) {
            this.success = success;
            this.failed = failed;
        }

        public static SubscribeResult failure(List<String> symbols, String reason) {
            Map<String, String> failed = new java.util.HashMap<>();
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
     * 
     */
    class PriceUpdateMessage {
        private String type;
        private String timestamp;
        private PriceData data;

        public static class PriceData {
            private String symbol;
            private String name;
            private Double price;
            private Double change;
            private Double changePercent;
            private Long volume;

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
     * （）
     */
    class PriceUpdate {
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
