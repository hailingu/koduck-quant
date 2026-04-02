package com.koduck.entity;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Stock real-time price quote entity.
 * Maps to stock_realtime table in PostgreSQL.
 */
@Entity
@Table(name = "stock_realtime")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockRealtime {
    
    @Id
    @Column(name = "symbol", length = 20)
    private String symbol;
    
    @Column(name = "name", nullable = false, length = 100)
    private String name;
    
    @Column(name = "type", nullable = false, length = 10)
    @Builder.Default
    private String type = "STOCK"; // STOCK or INDEX
    
    @Column(name = "price", precision = 18, scale = 4)
    private BigDecimal price;
    
    @Column(name = "open_price", precision = 18, scale = 4)
    private BigDecimal openPrice;
    
    @Column(name = "high", precision = 18, scale = 4)
    private BigDecimal high;
    
    @Column(name = "low", precision = 18, scale = 4)
    private BigDecimal low;
    
    @Column(name = "prev_close", precision = 18, scale = 4)
    private BigDecimal prevClose;
    
    @Column(name = "volume")
    private Long volume;
    
    @Column(name = "amount", precision = 24, scale = 2)
    private BigDecimal amount;
    
    @Column(name = "change_amount", precision = 18, scale = 4)
    private BigDecimal changeAmount;
    
    @Column(name = "change_percent", precision = 10, scale = 4)
    private BigDecimal changePercent;
    
    @Column(name = "bid_price", precision = 18, scale = 4)
    private BigDecimal bidPrice;
    
    @Column(name = "bid_volume")
    private Long bidVolume;
    
    @Column(name = "ask_price", precision = 18, scale = 4)
    private BigDecimal askPrice;
    
    @Column(name = "ask_volume")
    private Long askVolume;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
