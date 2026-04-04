package com.koduck.entity.market;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Daily market breadth aggregate entity.
 *
 * @author Koduck
 */
@Entity
@Table(
        name = "market_daily_breadth",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_market_daily_breadth",
                columnNames = {"market", "breadth_type", "trade_date"}
        ),
        indexes = {
            @Index(
                    name = "idx_market_daily_breadth_market_type_date",
                    columnList = "market, breadth_type, trade_date DESC"
                )
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketDailyBreadth {

    /**
     * Unique identifier.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Market identifier (e.g., US, CN).
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * Type of breadth metric.
     */
    @Column(name = "breadth_type", nullable = false, length = 20)
    private String breadthType;

    /**
     * Trading date.
     */
    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    /**
     * Number of gaining stocks.
     */
    @Column(name = "gainers", nullable = false)
    private Integer gainers;

    /**
     * Number of declining stocks.
     */
    @Column(name = "losers", nullable = false)
    private Integer losers;

    /**
     * Number of unchanged stocks.
     */
    @Column(name = "unchanged", nullable = false)
    private Integer unchanged;

    /**
     * Number of suspended stocks.
     */
    @Column(name = "suspended")
    private Integer suspended;

    /**
     * Total number of stocks.
     */
    @Column(name = "total_stocks", nullable = false)
    private Integer totalStocks;

    /**
     * Advance-decline line value.
     */
    @Column(name = "advance_decline_line", nullable = false)
    private Integer advanceDeclineLine;

    /**
     * Data source.
     */
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    /**
     * Data quality indicator.
     */
    @Column(name = "quality", nullable = false, length = 20)
    private String quality;

    /**
     * Snapshot timestamp.
     */
    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;

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
