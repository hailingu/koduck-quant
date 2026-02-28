package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * K-line (candlestick) data entity for storing historical price data.
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
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "market", nullable = false, length = 20)
    private String market;
    
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;
    
    @Column(name = "timeframe", nullable = false, length = 10)
    private String timeframe;
    
    @Column(name = "kline_time", nullable = false)
    private LocalDateTime klineTime;
    
    @Column(name = "open_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal openPrice;
    
    @Column(name = "high_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal highPrice;
    
    @Column(name = "low_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal lowPrice;
    
    @Column(name = "close_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal closePrice;
    
    @Column(name = "volume")
    private Long volume;
    
    @Column(name = "amount", precision = 24, scale = 8)
    private BigDecimal amount;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
