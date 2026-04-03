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
 * Sector-level market net-flow snapshot entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(
        name = "market_sector_net_flow",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_market_sector_net_flow",
                columnNames = {"market", "indicator", "trade_date",
                    "sector_type", "sector_name"}
        ),
        indexes = {
            @Index(name = "idx_market_sector_net_flow_market_indicator_date",
                    columnList = "market, indicator, trade_date DESC"),
            @Index(name = "idx_market_sector_net_flow_sector_type",
                    columnList = "sector_type, trade_date DESC")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketSectorNetFlow {

    /** Primary key ID. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** Market code (e.g., AShare). */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /** Indicator type (e.g., main). */
    @Column(name = "indicator", nullable = false, length = 20)
    private String indicator;

    /** Trade date. */
    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    /** Sector type (industry/concept/region). */
    @Column(name = "sector_type", nullable = false, length = 20)
    private String sectorType;

    /** Sector name. */
    @Column(name = "sector_name", nullable = false, length = 100)
    private String sectorName;

    /** Main force net inflow (in 10k CNY). */
    @Column(name = "main_force_net", nullable = false,
            precision = 20, scale = 2)
    private BigDecimal mainForceNet;

    /** Retail net inflow (in 10k CNY). */
    @Column(name = "retail_net", nullable = false,
            precision = 20, scale = 2)
    private BigDecimal retailNet;

    /** Super big order net inflow. */
    @Column(name = "super_big_net", precision = 20, scale = 2)
    private BigDecimal superBigNet;

    /** Big order net inflow. */
    @Column(name = "big_net", precision = 20, scale = 2)
    private BigDecimal bigNet;

    /** Medium order net inflow. */
    @Column(name = "medium_net", precision = 20, scale = 2)
    private BigDecimal mediumNet;

    /** Small order net inflow. */
    @Column(name = "small_net", precision = 20, scale = 2)
    private BigDecimal smallNet;

    /** Change percentage. */
    @Column(name = "change_pct", precision = 10, scale = 4)
    private BigDecimal changePct;

    /** Data source. */
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    /** Data quality indicator. */
    @Column(name = "quality", nullable = false, length = 20)
    private String quality;

    /** Snapshot timestamp. */
    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;

    /** Last update timestamp. */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Creation timestamp. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
