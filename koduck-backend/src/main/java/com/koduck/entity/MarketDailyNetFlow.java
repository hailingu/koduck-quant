package com.koduck.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import jakarta.persistence.*;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Daily market net flow aggregate entity.
 */
@Entity
@Table(
        name = "market_daily_net_flow",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_market_daily_net_flow",
                columnNames = {"market", "flow_type", "trade_date"}
        ),
        indexes = {
                @Index(name = "idx_market_daily_net_flow_market_flow_date", columnList = "market, flow_type, trade_date DESC")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketDailyNetFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "market", nullable = false, length = 20)
    private String market;

    @Column(name = "flow_type", nullable = false, length = 20)
    private String flowType;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "net_inflow", nullable = false, precision = 20, scale = 2)
    private BigDecimal netInflow;

    @Column(name = "total_inflow", precision = 20, scale = 2)
    private BigDecimal totalInflow;

    @Column(name = "total_outflow", precision = 20, scale = 2)
    private BigDecimal totalOutflow;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

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
