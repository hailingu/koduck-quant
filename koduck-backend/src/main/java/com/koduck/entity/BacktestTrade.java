package com.koduck.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Backtest trade entity representing individual trades in a backtest.
 *
 * @author koduck
 */
@Entity
@Table(name = "backtest_trades",
       indexes = {
           @Index(name = "idx_btrade_result", columnList = "backtest_result_id"),
           @Index(name = "idx_btrade_date", columnList = "trade_time")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestTrade {

    /** Unique identifier for the trade. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** ID of the associated backtest result. */
    @Column(name = "backtest_result_id", nullable = false)
    private Long backtestResultId;

    /** Type of trade (BUY or SELL). */
    @Column(name = "trade_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private TradeType tradeType;

    /** Timestamp when the trade occurred. */
    @Column(name = "trade_time", nullable = false)
    private LocalDateTime tradeTime;

    /** Stock symbol traded. */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /** Trade price per share. */
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    /** Number of shares traded. */
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** Total trade amount (price * quantity). */
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    /** Commission paid for the trade. */
    @Column(name = "commission", nullable = false, precision = 19, scale = 4)
    private BigDecimal commission;

    /** Slippage cost for the trade. */
    @Column(name = "slippage_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal slippageCost;

    /** Total cost including commission and slippage. */
    @Column(name = "total_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalCost;

    /** Cash balance after the trade. */
    @Column(name = "cash_after", nullable = false, precision = 19, scale = 4)
    private BigDecimal cashAfter;

    /** Position size after the trade. */
    @Column(name = "position_after", nullable = false, precision = 19, scale = 4)
    private BigDecimal positionAfter;

    /** Profit/loss amount for the trade. */
    @Column(name = "pnl", precision = 19, scale = 4)
    private BigDecimal pnl;

    /** Profit/loss percentage for the trade. */
    @Column(name = "pnl_percent", precision = 10, scale = 4)
    private BigDecimal pnlPercent;

    /** Reason for the trade signal. */
    @Column(name = "signal_reason", length = 255)
    private String signalReason;

    /** Timestamp when the record was created. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** Enumeration of trade types. */
    public enum TradeType {
        /** Buy trade type. */
        BUY,
        /** Sell trade type. */
        SELL
    }
}
