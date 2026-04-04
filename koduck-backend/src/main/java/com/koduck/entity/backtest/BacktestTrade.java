package com.koduck.entity.backtest;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

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
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class BacktestTrade extends BaseTrade {

    /** Unique identifier for the trade. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** ID of the associated backtest result. */
    @Column(name = "backtest_result_id", nullable = false)
    private Long backtestResultId;

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
}
