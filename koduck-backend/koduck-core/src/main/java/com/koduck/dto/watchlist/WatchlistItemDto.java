package com.koduck.dto.watchlist;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Watchlist item DTO with real-time price.
 *
 * @author Koduck Team
 * @param id the ID
 * @param market the market
 * @param symbol 品种代码
 * @param name 名称
 * @param sortOrder the sort order
 * @param notes the notes
 * @param price 价格
 * @param change 涨跌额
 * @param changePercent 涨跌幅
 * @param createdAt 创建时间 timestamp
 */
public record WatchlistItemDto(
    Long id,
    String market,
    String symbol,
    String name,
    Integer sortOrder,
    String notes,
    BigDecimal price,
    BigDecimal change,
    BigDecimal changePercent,
    LocalDateTime createdAt
) {

    /**
     * 创建新的 Builder 实例。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * WatchlistItemDto 的构建器。
     */
    public static class Builder {

        /** The ID. */
        private Long id;

        /** The market. */
        private String market;
        /** 品种代码。 */
        private String symbol;
        /** 名称。 */
        private String name;

        /** The sort order. */
        private Integer sortOrder;

        /** The notes. */
        private String notes;
        /** 价格。 */
        private BigDecimal price;
        /** 涨跌额。 */
        private BigDecimal change;
        /** 涨跌幅。 */
        private BigDecimal changePercent;

        /** The created at timestamp. */
        private LocalDateTime createdAt;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return 构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the market.
         *
         * @param market the market
         * @return 构建器
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

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
         * Sets the sort order.
         *
         * @param sortOrder the sort order
         * @return 构建器
         */
        public Builder sortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
            return this;
        }

        /**
         * Sets the notes.
         *
         * @param notes the notes
         * @return 构建器
         */
        public Builder notes(String notes) {
            this.notes = notes;
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
         * Sets the created at timestamp.
         *
         * @param createdAt 创建时间 timestamp
         * @return 构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Builds the WatchlistItemDto.
         *
         * @return the WatchlistItemDto
         */
        public WatchlistItemDto build() {
            return new WatchlistItemDto(id, market, symbol, name, sortOrder, notes,
                                       price, change, changePercent, createdAt);
        }
    }
}
