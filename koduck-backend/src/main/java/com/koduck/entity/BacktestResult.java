package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 
 */
@Entity
@Table(name = "backtest_results",
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
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;
    
    @Column(name = "strategy_version")
    private Integer strategyVersion;
    
    @Column(name = "market", nullable = false, length = 20)
    private String market;
    
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;
    
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;
    
    @Column(name = "timeframe", length = 10)
    @Builder.Default
    private String timeframe = "1D";
    
    // 
    @Column(name = "initial_capital", nullable = false, precision = 19, scale = 4)
    private BigDecimal initialCapital;
    
    @Column(name = "commission_rate", precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal commissionRate = new BigDecimal("0.001");
    
    @Column(name = "slippage", precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal slippage = new BigDecimal("0.001");
    
    // 
    @Column(name = "final_capital", precision = 19, scale = 4)
    private BigDecimal finalCapital;
    
    @Column(name = "total_return", precision = 10, scale = 4)
    private BigDecimal totalReturn;
    
    @Column(name = "annualized_return", precision = 10, scale = 4)
    private BigDecimal annualizedReturn;
    
    @Column(name = "max_drawdown", precision = 10, scale = 4)
    private BigDecimal maxDrawdown;
    
    @Column(name = "sharpe_ratio", precision = 10, scale = 4)
    private BigDecimal sharpeRatio;
    
    @Column(name = "total_trades")
    private Integer totalTrades;
    
    @Column(name = "winning_trades")
    private Integer winningTrades;
    
    @Column(name = "losing_trades")
    private Integer losingTrades;
    
    @Column(name = "win_rate", precision = 10, scale = 4)
    private BigDecimal winRate;
    
    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;
    
    @Column(name = "avg_loss", precision = 19, scale = 4)
    private BigDecimal avgLoss;
    
    @Column(name = "profit_factor", precision = 10, scale = 4)
    private BigDecimal profitFactor;
    
    // 
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BacktestStatus status = BacktestStatus.PENDING;
    
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    
    public enum BacktestStatus {
        PENDING,     // 
        RUNNING,     // 
        COMPLETED,   // 
        FAILED       // 
    }
}
