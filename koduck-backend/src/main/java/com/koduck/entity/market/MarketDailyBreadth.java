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
 * 每日市场涨跌宽度聚合实体。
 *
 * @author Koduck Team
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
     * 宽度指标类型。
     */
    @Column(name = "breadth_type", nullable = false, length = 20)
    private String breadthType;

    /**
     * 交易日。
     */
    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    /**
     * 上涨股票数量。
     */
    @Column(name = "gainers", nullable = false)
    private Integer gainers;

    /**
     * 下跌股票数量。
     */
    @Column(name = "losers", nullable = false)
    private Integer losers;

    /**
     * 平盘股票数量。
     */
    @Column(name = "unchanged", nullable = false)
    private Integer unchanged;

    /**
     * 停牌股票数量。
     */
    @Column(name = "suspended")
    private Integer suspended;

    /**
     * 股票总数。
     */
    @Column(name = "total_stocks", nullable = false)
    private Integer totalStocks;

    /**
     * 涨跌线值。
     */
    @Column(name = "advance_decline_line", nullable = false)
    private Integer advanceDeclineLine;

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
