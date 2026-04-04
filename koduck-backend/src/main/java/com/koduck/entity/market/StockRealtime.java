package com.koduck.entity.market;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Stock real-time price quote entity.
 * Maps to stock_realtime table in PostgreSQL.
 *
 * @author Koduck
 */
@Entity
@Table(name = "stock_realtime")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockRealtime {

    /**
     * Stock symbol (ticker).
     */
    @Id
    @Column(name = "symbol", length = 20)
    private String symbol;

    /**
     * Stock name.
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * Stock type: STOCK or INDEX.
     */
    @Column(name = "type", nullable = false, length = 10)
    @Builder.Default
    private String type = "STOCK";

    /**
     * Current price.
     */
    @Column(name = "price", precision = 18, scale = 4)
    private BigDecimal price;

    /**
     * Opening price.
     */
    @Column(name = "open_price", precision = 18, scale = 4)
    private BigDecimal openPrice;

    /**
     * High price of the day.
     */
    @Column(name = "high", precision = 18, scale = 4)
    private BigDecimal high;

    /**
     * Low price of the day.
     */
    @Column(name = "low", precision = 18, scale = 4)
    private BigDecimal low;

    /**
     * Previous closing price.
     */
    @Column(name = "prev_close", precision = 18, scale = 4)
    private BigDecimal prevClose;

    /**
     * Trading volume.
     */
    @Column(name = "volume")
    private Long volume;

    /**
     * Trading amount.
     */
    @Column(name = "amount", precision = 24, scale = 2)
    private BigDecimal amount;

    /**
     * Price change amount.
     */
    @Column(name = "change_amount", precision = 18, scale = 4)
    private BigDecimal changeAmount;

    /**
     * Price change percentage.
     */
    @Column(name = "change_percent", precision = 10, scale = 4)
    private BigDecimal changePercent;

    /**
     * Bid price.
     */
    @Column(name = "bid_price", precision = 18, scale = 4)
    private BigDecimal bidPrice;

    /**
     * Bid volume.
     */
    @Column(name = "bid_volume")
    private Long bidVolume;

    /**
     * Ask price.
     */
    @Column(name = "ask_price", precision = 18, scale = 4)
    private BigDecimal askPrice;

    /**
     * Ask volume.
     */
    @Column(name = "ask_volume")
    private Long askVolume;

    /**
     * Last update timestamp.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Creation timestamp.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
