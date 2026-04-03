package com.koduck.entity;

import java.math.BigDecimal;
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
 * Daily market net flow aggregate entity.
 *
 * @author Koduck
 */
@Entity
@Table(
        name = "market_daily_net_flow",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_market_daily_net_flow",
                columnNames = {"market", "flow_type", "trade_date"}
        ),
        indexes = {
            @Index(
                    name = "idx_market_daily_net_flow_market_flow_date",
                    columnList = "market, flow_type, trade_date DESC"
                )
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketDailyNetFlow {

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
     * Flow type.
     */
    @Column(name = "flow_type", nullable = false, length = 20)
    private String flowType;

    /**
     * Trading date.
     */
    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    /**
     * Net inflow amount.
     */
    @Column(name = "net_inflow", nullable = false, precision = 20, scale = 2)
    private BigDecimal netInflow;

    /**
     * Total inflow amount.
     */
    @Column(name = "total_inflow", precision = 20, scale = 2)
    private BigDecimal totalInflow;

    /**
     * Total outflow amount.
     */
    @Column(name = "total_outflow", precision = 20, scale = 2)
    private BigDecimal totalOutflow;

    /**
     * Currency code.
     */
    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

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
