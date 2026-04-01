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
 * 
 */
@Entity
@Table(name = "trades",
       indexes = {
           @Index(name = "idx_trade_user", columnList = "user_id"),
           @Index(name = "idx_trade_symbol", columnList = "market, symbol"),
           @Index(name = "idx_trade_time", columnList = "trade_time")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Trade {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "market", nullable = false, length = 20)
    private String market;
    
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;
    
    @Column(name = "name", length = 100)
    private String name;
    
    @Column(name = "trade_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private TradeType tradeType;
    
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;
    
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;
    
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;
    
    @Column(name = "trade_time", nullable = false)
    private LocalDateTime tradeTime;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "status", length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TradeStatus status = TradeStatus.SUCCESS;
    
    @Column(name = "notes", length = 500)
    private String notes;
    
    public enum TradeType {
        BUY, SELL
    }
    
    public enum TradeStatus {
        PENDING,    // 待执行
        SUCCESS,    // 成功
        FAILED,     // 失败
        CANCELLED   // 已取消
    }
}
