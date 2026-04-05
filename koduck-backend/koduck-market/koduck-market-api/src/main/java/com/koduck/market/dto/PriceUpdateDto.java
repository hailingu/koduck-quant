package com.koduck.market.dto;

/**
 * Price update data transfer object.
 * Used for real-time price updates and WebSocket messages.
 *
 * @param symbol the stock symbol
 * @param name the stock name
 * @param price the current price
 * @param change the price change
 * @param changePercent the price change percentage
 * @param volume the trading volume
 * @author Koduck Team
 */
public record PriceUpdateDto(
    String symbol,
    String name,
    Double price,
    Double change,
    Double changePercent,
    Long volume
) {
    public PriceUpdateDto {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol cannot be blank");
        }
    }

    /**
     * 创建新的 Builder 实例。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for PriceUpdateDto.
     */
    public static class Builder {
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
         * 设置价格。
         *
         * @param price 价格
         * @return 构建器
         */
        public Builder price(Double price) {
            this.price = price;
            return this;
        }

        /**
         * 设置涨跌额。
         *
         * @param change 涨跌额
         * @return 构建器
         */
        public Builder change(Double change) {
            this.change = change;
            return this;
        }

        /**
         * 设置涨跌幅。
         *
         * @param changePercent 涨跌幅
         * @return 构建器
         */
        public Builder changePercent(Double changePercent) {
            this.changePercent = changePercent;
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
         * Builds the PriceUpdateDto.
         *
         * @return the PriceUpdateDto
         */
        public PriceUpdateDto build() {
            return new PriceUpdateDto(symbol, name, price, change, changePercent, volume);
        }
    }
}
