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
 * 
 */
@Entity
@Table(name = "portfolio_positions",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_portfolio_user_symbol",
           columnNames = {"user_id", "market", "symbol"}
       ),
       indexes = {
           @Index(name = "idx_portfolio_user", columnList = "user_id"),
           @Index(name = "idx_portfolio_symbol", columnList = "market, symbol")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioPosition {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "market", nullable = false, length = 20)
    private String market;
    
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;
    
    @Column(name = "name", length = 100)
    private String name;
    
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;
    
    @Column(name = "avg_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal avgCost;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
