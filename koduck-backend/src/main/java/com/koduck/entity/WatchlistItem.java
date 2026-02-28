package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Watchlist (自选股) item entity for user stock tracking.
 */
@Entity
@Table(name = "watchlist_items",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_watchlist_user_symbol",
           columnNames = {"user_id", "market", "symbol"}
       ),
       indexes = {
           @Index(name = "idx_watchlist_user", columnList = "user_id"),
           @Index(name = "idx_watchlist_symbol", columnList = "market, symbol"),
           @Index(name = "idx_watchlist_sort", columnList = "user_id, sort_order")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchlistItem {
    
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
    
    @Column(name = "sort_order")
    private Integer sortOrder;
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
