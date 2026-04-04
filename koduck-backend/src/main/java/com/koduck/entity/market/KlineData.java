package com.koduck.entity.market;

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
 * K-line (candlestick) data entity for storing historical price data.
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
     * The unique identifier for the kline data.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * The market code (e.g., US, HK, CN).
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * The stock symbol.
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * The timeframe of the kline data (e.g., 1d, 1w, 1m).
     */
    @Column(name = "timeframe", nullable = false, length = 10)
    private String timeframe;

    /**
     * The timestamp of the kline data.
     */
    @Column(name = "kline_time", nullable = false)
    private LocalDateTime klineTime;

    /**
     * The opening price.
     */
    @Column(name = "open_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal openPrice;

    /**
     * The highest price.
     */
    @Column(name = "high_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal highPrice;

    /**
     * The lowest price.
     */
    @Column(name = "low_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal lowPrice;

    /**
     * The closing price.
     */
    @Column(name = "close_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal closePrice;

    /**
     * The trading volume.
     */
    @Column(name = "volume")
    private Long volume;

    /**
     * The trading amount.
     */
    @Column(name = "amount", precision = 24, scale = 8)
    private BigDecimal amount;

    /**
     * The previous closing price.
     */
    @Column(name = "pre_close_price", precision = 18, scale = 8)
    private BigDecimal preClosePrice;

    /**
     * Flag indicating if trading is suspended.
     */
    @Column(name = "is_suspended", nullable = false)
    @Builder.Default
    private Boolean isSuspended = false;

    /**
     * The creation timestamp.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * The last update timestamp.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
