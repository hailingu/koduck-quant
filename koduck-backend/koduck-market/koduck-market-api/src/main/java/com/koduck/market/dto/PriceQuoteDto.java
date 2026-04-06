package com.koduck.market.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 实时价格行情数据传输对象。
 *
 * @author Koduck Team
 * @param symbol 品种代码
 * @param name 名称
 * @param type 类型
 * @param price 价格
 * @param open 开盘价
 * @param high 最高价
 * @param low 最低价
 * @param prevClose 前收盘价
 * @param volume 成交量
 * @param amount 成交额
 * @param change 涨跌额
 * @param changePercent 涨跌幅
 * @param bidPrice 买入价
 * @param bidVolume 买入量
 * @param askPrice 卖出价
 * @param askVolume 卖出量
 * @param timestamp 时间戳
 */
public record PriceQuoteDto(
    String symbol,
    String name,
    String type,
    BigDecimal price,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal prevClose,
    Long volume,
    BigDecimal amount,
    BigDecimal change,
    BigDecimal changePercent,
    BigDecimal bidPrice,
    Long bidVolume,
    BigDecimal askPrice,
    Long askVolume,
    Instant timestamp
) {
    public PriceQuoteDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }

    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }

    /**
     * PriceQuoteDto 的构建器。
     */
    public static class Builder {
        /** 品种代码。 */
        private String symbol;
        /** 名称。 */
        private String name;
        /** 类型。 */
        private String type;
        /** 价格。 */
        private BigDecimal price;
        /** 开盘价。 */
        private BigDecimal open;
        /** 最高价。 */
        private BigDecimal high;
        /** 最低价。 */
        private BigDecimal low;
        /** 前收盘价。 */
        private BigDecimal prevClose;
        /** 成交量。 */
        private Long volume;
        /** 成交额。 */
        private BigDecimal amount;
        /** 涨跌额。 */
        private BigDecimal change;
        /** 涨跌幅。 */
        private BigDecimal changePercent;
        /** 买入价。 */
        private BigDecimal bidPrice;
        /** 买入量。 */
        private Long bidVolume;
        /** 卖出价。 */
        private BigDecimal askPrice;
        /** 卖出量。 */
        private Long askVolume;
        /** 时间戳。 */
        private Instant timestamp;

        /**
         * 设置品种代码。
         *
         * @param symbol 品种代码
         * @return 构建器
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * 设置名称。
         *
         * @param name 名称
         * @return 构建器
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * 设置类型。
         *
         * @param type 类型
         * @return 构建器
         */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /**
         * 设置价格。
         *
         * @param price 价格
         * @return 构建器
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * 设置开盘价。
         *
         * @param open 开盘价
         * @return 构建器
         */
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }

        /**
         * 设置最高价。
         *
         * @param high 最高价
         * @return 构建器
         */
        public Builder high(BigDecimal high) {
            this.high = high;
            return this;
        }

        /**
         * 设置最低价。
         *
         * @param low 最低价
         * @return 构建器
         */
        public Builder low(BigDecimal low) {
            this.low = low;
            return this;
        }

        /**
         * 设置前收盘价。
         *
         * @param prevClose 前收盘价
         * @return 构建器
         */
        public Builder prevClose(BigDecimal prevClose) {
            this.prevClose = prevClose;
            return this;
        }

        /**
         * 设置成交量。
         *
         * @param volume 成交量
         * @return 构建器
         */
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }

        /**
         * 设置成交额。
         *
         * @param amount 成交额
         * @return 构建器
         */
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        /**
         * 设置涨跌额。
         *
         * @param change 涨跌额
         * @return 构建器
         */
        public Builder change(BigDecimal change) {
            this.change = change;
            return this;
        }

        /**
         * 设置涨跌幅。
         *
         * @param changePercent 涨跌幅
         * @return 构建器
         */
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }

        /**
         * 设置买入价。
         *
         * @param bidPrice 买入价
         * @return 构建器
         */
        public Builder bidPrice(BigDecimal bidPrice) {
            this.bidPrice = bidPrice;
            return this;
        }

        /**
         * 设置买入量。
         *
         * @param bidVolume 买入量
         * @return 构建器
         */
        public Builder bidVolume(Long bidVolume) {
            this.bidVolume = bidVolume;
            return this;
        }

        /**
         * 设置卖出价。
         *
         * @param askPrice 卖出价
         * @return 构建器
         */
        public Builder askPrice(BigDecimal askPrice) {
            this.askPrice = askPrice;
            return this;
        }

        /**
         * 设置卖出量。
         *
         * @param askVolume 卖出量
         * @return 构建器
         */
        public Builder askVolume(Long askVolume) {
            this.askVolume = askVolume;
            return this;
        }

        /**
 * 设置时间戳。
         *
         * @param timestamp 时间戳
         * @return 构建器
         */
        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * 构建 PriceQuoteDto。
         *
         * @return PriceQuoteDto 实例
         */
        public PriceQuoteDto build() {
            return new PriceQuoteDto(
                symbol, name, type, price, open, high, low, prevClose,
                volume, amount, change, changePercent,
                bidPrice, bidVolume, askPrice, askVolume, timestamp
            );
        }
    }
}
