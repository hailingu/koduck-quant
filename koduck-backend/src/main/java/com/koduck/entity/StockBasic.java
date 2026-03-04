package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Stock basic information entity.
 * Maps to stock_basic table in PostgreSQL.
 */
@Entity
@Table(name = "stock_basic")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockBasic {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "symbol", nullable = false, unique = true, length = 20)
    private String symbol;
    
    @Column(name = "name", nullable = false, length = 100)
    private String name;
    
    @Column(name = "market", nullable = false, length = 20)
    private String market;
    
    @Column(name = "list_date")
    private LocalDate listDate;
    
    @Column(name = "delist_date")
    private LocalDate delistDate;
    
    @Column(name = "is_hs")
    @Builder.Default
    private Boolean isHs = false;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
