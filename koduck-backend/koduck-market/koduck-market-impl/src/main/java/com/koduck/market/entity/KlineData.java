package com.koduck.market.entity;

import java.math.BigDecimal;
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
 * K 线（蜡烛图）数据实体，用于存储历史价格数据。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "kline_data",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_kline_data",
           columnNames = {"market", "symbol", "timeframe", "kline_time"}
       ),
       indexes = {
           @Index(name = "idx_kline_market_symbol", columnList = "market, symbol"),
           @Index(name = "idx_kline_timeframe", columnList = "timeframe"),
           @Index(name = "idx_kline_time", columnList = "kline_time"),
           @Index(name = "idx_kline_composite", columnList = "market, symbol, timeframe, kline_time DESC")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KlineData {

    /**
     * K 线数据的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 市场代码（例如：US、HK、CN）。
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * 股票代码。
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * K 线数据的时间框架（例如：1d、1w、1m）。
     */
    @Column(name = "timeframe", nullable = false, length = 10)
    private String timeframe;

    /**
     * K 线数据的时间戳。
     */
    @Column(name = "kline_time", nullable = false)
    private LocalDateTime klineTime;

    /**
     * 开盘价。
     */
    @Column(name = "open_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal openPrice;

    /**
     * 最高价。
     */
    @Column(name = "high_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal highPrice;

    /**
     * 最低价。
     */
    @Column(name = "low_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal lowPrice;

    /**
     * 收盘价。
     */
    @Column(name = "close_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal closePrice;

    /**
     * 交易量。
     */
    @Column(name = "volume")
    private Long volume;

    /**
     * 交易额。
     */
    @Column(name = "amount", precision = 24, scale = 8)
    private BigDecimal amount;

    /**
     * 昨日收盘价。
     */
    @Column(name = "pre_close_price", precision = 18, scale = 8)
    private BigDecimal preClosePrice;

    /**
     * 指示是否停牌。
     */
    @Column(name = "is_suspended", nullable = false)
    @Builder.Default
    private Boolean isSuspended = false;

    /**
     * 创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
