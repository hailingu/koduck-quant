package com.koduck.dto.watchlist;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Watchlist item DTO with real-time price.
 *
 * @author Koduck Team
 * @param id the ID
 * @param market the market
 * @param symbol the symbol
 * @param name the name
 * @param sortOrder the sort order
 * @param notes the notes
 * @param price the price
 * @param change the change
 * @param changePercent the change percent
 * @param createdAt the created at timestamp
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
     * Creates a new Builder instance.
     *
     * @return the builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for WatchlistItemDto.
     */
    public static class Builder {

        /** The ID. */
        private Long id;

        /** The market. */
        private String market;

        /** The symbol. */
        private String symbol;

        /** The name. */
        private String name;

        /** The sort order. */
        private Integer sortOrder;

        /** The notes. */
        private String notes;

        /** The price. */
        private BigDecimal price;

        /** The change. */
        private BigDecimal change;

        /** The change percent. */
        private BigDecimal changePercent;

        /** The created at timestamp. */
        private LocalDateTime createdAt;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return the builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the market.
         *
         * @param market the market
         * @return the builder
         */
        public Builder market(String market) {
            this.market = market;
            return this;
        }

        /**
         * Sets the symbol.
         *
         * @param symbol the symbol
         * @return the builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Sets the name.
         *
         * @param name the name
         * @return the builder
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the sort order.
         *
         * @param sortOrder the sort order
         * @return the builder
         */
        public Builder sortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
            return this;
        }

        /**
         * Sets the notes.
         *
         * @param notes the notes
         * @return the builder
         */
        public Builder notes(String notes) {
            this.notes = notes;
            return this;
        }

        /**
         * Sets the price.
         *
         * @param price the price
         * @return the builder
         */
        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        /**
         * Sets the change.
         *
         * @param change the change
         * @return the builder
         */
        public Builder change(BigDecimal change) {
            this.change = change;
            return this;
        }

        /**
         * Sets the change percent.
         *
         * @param changePercent the change percent
         * @return the builder
         */
        public Builder changePercent(BigDecimal changePercent) {
            this.changePercent = changePercent;
            return this;
        }

        /**
         * Sets the created at timestamp.
         *
         * @param createdAt the created at timestamp
         * @return the builder
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
