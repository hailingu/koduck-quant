package com.koduck.entity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Sector-level market net-flow snapshot entity.
 */
@Entity
@Table(
        name = "market_sector_net_flow",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_market_sector_net_flow",
                columnNames = {"market", "indicator", "trade_date", "sector_type", "sector_name"}
        ),
        indexes = {
                @Index(name = "idx_market_sector_net_flow_market_indicator_date", columnList = "market, indicator, trade_date DESC"),
                @Index(name = "idx_market_sector_net_flow_sector_type", columnList = "sector_type, trade_date DESC")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketSectorNetFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "market", nullable = false, length = 20)
    private String market;

    @Column(name = "indicator", nullable = false, length = 20)
    private String indicator;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "sector_type", nullable = false, length = 20)
    private String sectorType;

    @Column(name = "sector_name", nullable = false, length = 100)
    private String sectorName;

    @Column(name = "main_force_net", nullable = false, precision = 20, scale = 2)
    private BigDecimal mainForceNet;

    @Column(name = "retail_net", nullable = false, precision = 20, scale = 2)
    private BigDecimal retailNet;

    @Column(name = "super_big_net", precision = 20, scale = 2)
    private BigDecimal superBigNet;

    @Column(name = "big_net", precision = 20, scale = 2)
    private BigDecimal bigNet;

    @Column(name = "medium_net", precision = 20, scale = 2)
    private BigDecimal mediumNet;

    @Column(name = "small_net", precision = 20, scale = 2)
    private BigDecimal smallNet;

    @Column(name = "change_pct", precision = 10, scale = 4)
    private BigDecimal changePct;

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
