package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 回测交易记录实体
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
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "backtest_result_id", nullable = false)
    private Long backtestResultId;
    
    @Column(name = "trade_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private TradeType tradeType;
    
    @Column(name = "trade_time", nullable = false)
    private LocalDateTime tradeTime;
    
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;
    
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;
    
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;
    
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;
    
    @Column(name = "commission", nullable = false, precision = 19, scale = 4)
    private BigDecimal commission;
    
    @Column(name = "slippage_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal slippageCost;
    
    @Column(name = "total_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalCost;
    
    @Column(name = "cash_after", nullable = false, precision = 19, scale = 4)
    private BigDecimal cashAfter;
    
    @Column(name = "position_after", nullable = false, precision = 19, scale = 4)
    private BigDecimal positionAfter;
    
    @Column(name = "pnl", precision = 19, scale = 4)
    private BigDecimal pnl;
    
    @Column(name = "pnl_percent", precision = 10, scale = 4)
    private BigDecimal pnlPercent;
    
    @Column(name = "signal_reason", length = 255)
    private String signalReason;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    public enum TradeType {
        BUY, SELL
    }
}
