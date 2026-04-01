package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Daily market breadth aggregate entity.
 */
@Entity
@Table(
        name = "market_daily_breadth",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_market_daily_breadth",
                columnNames = {"market", "breadth_type", "trade_date"}
        ),
        indexes = {
                @Index(name = "idx_market_daily_breadth_market_type_date", columnList = "market, breadth_type, trade_date DESC")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketDailyBreadth {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "market", nullable = false, length = 20)
    private String market;

    @Column(name = "breadth_type", nullable = false, length = 20)
    private String breadthType;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "gainers", nullable = false)
    private Integer gainers;

    @Column(name = "losers", nullable = false)
    private Integer losers;

    @Column(name = "unchanged", nullable = false)
    private Integer unchanged;

    @Column(name = "suspended")
    private Integer suspended;

    @Column(name = "total_stocks", nullable = false)
    private Integer totalStocks;

    @Column(name = "advance_decline_line", nullable = false)
    private Integer advanceDeclineLine;

    @Column(name = "source", nullable = false, length = 50)
    private String source;

    @Column(name = "quality", nullable = false, length = 20)
    private String quality;

    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
