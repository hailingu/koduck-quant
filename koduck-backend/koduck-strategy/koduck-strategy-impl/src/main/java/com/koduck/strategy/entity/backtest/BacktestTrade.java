package com.koduck.strategy.entity.backtest;

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

import com.koduck.portfolio.entity.BaseTrade;

/**
 * 回测交易实体，表示回测中的单笔交易。
 *
 * @author Koduck Team
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

    /** 交易的唯一标识符。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 关联的回测结果 ID。 */
    @Column(name = "backtest_result_id", nullable = false)
    private Long backtestResultId;

    /** 交易手续费。 */
    @Column(name = "commission", nullable = false, precision = 19, scale = 4)
    private BigDecimal commission;

    /** 交易滑点成本。 */
    @Column(name = "slippage_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal slippageCost;

    /** 总成本（包含手续费和滑点）。 */
    @Column(name = "total_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalCost;

    /** 交易后的现金余额。 */
    @Column(name = "cash_after", nullable = false, precision = 19, scale = 4)
    private BigDecimal cashAfter;

    /** 交易后的持仓数量。 */
    @Column(name = "position_after", nullable = false, precision = 19, scale = 4)
    private BigDecimal positionAfter;

    /** 交易盈亏金额。 */
    @Column(name = "pnl", precision = 19, scale = 4)
    private BigDecimal pnl;

    /** 交易盈亏百分比。 */
    @Column(name = "pnl_percent", precision = 10, scale = 4)
    private BigDecimal pnlPercent;

    /** 交易信号原因。 */
    @Column(name = "signal_reason", length = 255)
    private String signalReason;
}
