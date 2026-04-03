package com.koduck.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
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

import com.koduck.common.constants.MarketConstants;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Backtest result entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(
    name = "backtest_results",
    indexes = {
        @Index(name = "idx_backtest_user", columnList = "user_id"),
        @Index(name = "idx_backtest_strategy", columnList = "strategy_id"),
        @Index(name = "idx_backtest_status", columnList = "status")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestResult {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Strategy ID.
     */
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    /**
     * Strategy version.
     */
    @Column(name = "strategy_version")
    private Integer strategyVersion;

    /**
     * Market.
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * Symbol.
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * Start date.
     */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /**
     * End date.
     */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /**
     * Timeframe.
     */
    @Column(name = "timeframe", length = 10)
    @Builder.Default
    private String timeframe = MarketConstants.DEFAULT_TIMEFRAME;

    /**
     * Initial capital.
     */
    @Column(name = "initial_capital", nullable = false, precision = 19, scale = 4)
    private BigDecimal initialCapital;

    /**
     * Commission rate.
     */
    @Column(name = "commission_rate", precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal commissionRate = new BigDecimal("0.001");

    /**
     * Slippage.
     */
    @Column(name = "slippage", precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal slippage = new BigDecimal("0.001");

    /**
     * Final capital.
     */
    @Column(name = "final_capital", precision = 19, scale = 4)
    private BigDecimal finalCapital;

    /**
     * Total return.
     */
    @Column(name = "total_return", precision = 10, scale = 4)
    private BigDecimal totalReturn;

    /**
     * Annualized return.
     */
    @Column(name = "annualized_return", precision = 10, scale = 4)
    private BigDecimal annualizedReturn;

    /**
     * Maximum drawdown.
     */
    @Column(name = "max_drawdown", precision = 10, scale = 4)
    private BigDecimal maxDrawdown;

    /**
     * Sharpe ratio.
     */
    @Column(name = "sharpe_ratio", precision = 10, scale = 4)
    private BigDecimal sharpeRatio;

    /**
     * Total trades count.
     */
    @Column(name = "total_trades")
    private Integer totalTrades;

    /**
     * Winning trades count.
     */
    @Column(name = "winning_trades")
    private Integer winningTrades;

    /**
     * Losing trades count.
     */
    @Column(name = "losing_trades")
    private Integer losingTrades;

    /**
     * Win rate.
     */
    @Column(name = "win_rate", precision = 10, scale = 4)
    private BigDecimal winRate;

    /**
     * Average profit.
     */
    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;

    /**
     * Average loss.
     */
    @Column(name = "avg_loss", precision = 19, scale = 4)
    private BigDecimal avgLoss;

    /**
     * Profit factor.
     */
    @Column(name = "profit_factor", precision = 10, scale = 4)
    private BigDecimal profitFactor;

    /**
     * Backtest status.
     */
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BacktestStatus status = BacktestStatus.PENDING;

    /**
     * Error message.
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Completed at.
     */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /**
     * Backtest status enum.
     */
    public enum BacktestStatus {

        /**
         * Pending status.
         */
        PENDING,

        /**
         * Running status.
         */
        RUNNING,

        /**
         * Completed status.
         */
        COMPLETED,

        /**
         * Failed status.
         */
        FAILED
    }
}
