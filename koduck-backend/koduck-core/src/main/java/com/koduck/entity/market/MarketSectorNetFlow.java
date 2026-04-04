package com.koduck.entity.market;

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
 * 板块级市场资金流向快照实体。
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

    /** 主键 ID。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 市场代码（例如：AShare）。 */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /** 指标类型（例如：main）。 */
    @Column(name = "indicator", nullable = false, length = 20)
    private String indicator;

    /** 交易日。 */
    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    /** 板块类型（行业/概念/地区）。 */
    @Column(name = "sector_type", nullable = false, length = 20)
    private String sectorType;

    /** 板块名称。 */
    @Column(name = "sector_name", nullable = false, length = 100)
    private String sectorName;

    /** 主力资金净流入（单位：万元）。 */
    @Column(name = "main_force_net", nullable = false,
            precision = 20, scale = 2)
    private BigDecimal mainForceNet;

    /** 散户净流入（单位：万元）。 */
    @Column(name = "retail_net", nullable = false,
            precision = 20, scale = 2)
    private BigDecimal retailNet;

    /** 超大单净流入。 */
    @Column(name = "super_big_net", precision = 20, scale = 2)
    private BigDecimal superBigNet;

    /** 大单净流入。 */
    @Column(name = "big_net", precision = 20, scale = 2)
    private BigDecimal bigNet;

    /** 中单净流入。 */
    @Column(name = "medium_net", precision = 20, scale = 2)
    private BigDecimal mediumNet;

    /** 小单净流入。 */
    @Column(name = "small_net", precision = 20, scale = 2)
    private BigDecimal smallNet;

    /** 涨跌幅。 */
    @Column(name = "change_pct", precision = 10, scale = 4)
    private BigDecimal changePct;

    /** 数据源。 */
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    /** 数据质量指示器。 */
    @Column(name = "quality", nullable = false, length = 20)
    private String quality;

    /** 快照时间戳。 */
    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;

    /** 最后更新时间戳。 */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** 创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
