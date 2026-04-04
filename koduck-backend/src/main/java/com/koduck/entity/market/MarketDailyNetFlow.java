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
 * 每日市场资金流向聚合实体。
 *
 * @author Koduck Team
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
     * 唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 市场标识符（例如：US、CN）。
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * 资金流向类型。
     */
    @Column(name = "flow_type", nullable = false, length = 20)
    private String flowType;

    /**
     * 交易日。
     */
    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    /**
     * 净流入金额。
     */
    @Column(name = "net_inflow", nullable = false, precision = 20, scale = 2)
    private BigDecimal netInflow;

    /**
     * 总流入金额。
     */
    @Column(name = "total_inflow", precision = 20, scale = 2)
    private BigDecimal totalInflow;

    /**
     * 总流出金额。
     */
    @Column(name = "total_outflow", precision = 20, scale = 2)
    private BigDecimal totalOutflow;

    /**
     * 货币代码。
     */
    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    /**
     * 数据源。
     */
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    /**
     * 数据质量指示器。
     */
    @Column(name = "quality", nullable = false, length = 20)
    private String quality;

    /**
     * 快照时间戳。
     */
    @Column(name = "snapshot_time", nullable = false)
    private LocalDateTime snapshotTime;

    /**
     * 最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
