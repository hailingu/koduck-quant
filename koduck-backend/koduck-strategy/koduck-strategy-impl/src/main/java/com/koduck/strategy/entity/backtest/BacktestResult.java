package com.koduck.strategy.entity.backtest;

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
 * 回测结果实体。
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
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 策略 ID。
     */
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    /**
     * 策略版本。
     */
    @Column(name = "strategy_version")
    private Integer strategyVersion;

    /**
     * 市场。
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * 股票代码。
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * 开始日期。
     */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /**
     * 结束日期。
     */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /**
     * 时间框架。
     */
    @Column(name = "timeframe", length = 10)
    @Builder.Default
    private String timeframe = MarketConstants.DEFAULT_TIMEFRAME;

    /**
     * 初始资金。
     */
    @Column(name = "initial_capital", nullable = false, precision = 19, scale = 4)
    private BigDecimal initialCapital;

    /**
     * 手续费率。
     */
    @Column(name = "commission_rate", precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal commissionRate = new BigDecimal("0.001");

    /**
     * 滑点。
     */
    @Column(name = "slippage", precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal slippage = new BigDecimal("0.001");

    /**
     * 最终资金。
     */
    @Column(name = "final_capital", precision = 19, scale = 4)
    private BigDecimal finalCapital;

    /**
     * 总收益率。
     */
    @Column(name = "total_return", precision = 10, scale = 4)
    private BigDecimal totalReturn;

    /**
     * 年化收益率。
     */
    @Column(name = "annualized_return", precision = 10, scale = 4)
    private BigDecimal annualizedReturn;

    /**
     * 最大回撤。
     */
    @Column(name = "max_drawdown", precision = 10, scale = 4)
    private BigDecimal maxDrawdown;

    /**
     * 夏普比率。
     */
    @Column(name = "sharpe_ratio", precision = 10, scale = 4)
    private BigDecimal sharpeRatio;

    /**
     * 总交易次数。
     */
    @Column(name = "total_trades")
    private Integer totalTrades;

    /**
     * 盈利交易次数。
     */
    @Column(name = "winning_trades")
    private Integer winningTrades;

    /**
     * 亏损交易次数。
     */
    @Column(name = "losing_trades")
    private Integer losingTrades;

    /**
     * 胜率。
     */
    @Column(name = "win_rate", precision = 10, scale = 4)
    private BigDecimal winRate;

    /**
     * 平均盈利。
     */
    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;

    /**
     * 平均亏损。
     */
    @Column(name = "avg_loss", precision = 19, scale = 4)
    private BigDecimal avgLoss;

    /**
     * 盈亏比。
     */
    @Column(name = "profit_factor", precision = 10, scale = 4)
    private BigDecimal profitFactor;

    /**
     * 回测状态。
     */
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BacktestStatus status = BacktestStatus.PENDING;

    /**
     * 错误信息。
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 完成时间。
     */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /**
     * 回测状态枚举。
     */
    public enum BacktestStatus {

        /**
         * 待处理状态。
         */
        PENDING,

        /**
         * 运行中状态。
         */
        RUNNING,

        /**
         * 已完成状态。
         */
        COMPLETED,

        /**
         * 失败状态。
         */
        FAILED
    }
}
