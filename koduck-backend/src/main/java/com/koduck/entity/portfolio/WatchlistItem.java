package com.koduck.entity.portfolio;
import com.koduck.entity.auth.User;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Watchlist item entity for user stock tracking.
 * Represents a stock symbol that a user is tracking in their watchlist.
 *
 * @author GitHub Copilot
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

    /**
     * Unique identifier for the watchlist item.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * ID of the user who owns this watchlist item.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Market code (e.g., "AShare").
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * Stock symbol code.
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * Display name of the stock.
     */
    @Column(name = "name", length = 100)
    private String name;

    /**
     * Sort order for displaying items in the watchlist.
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    /**
     * User notes for this watchlist item.
     */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /**
     * Timestamp when the item was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Timestamp when the item was last updated.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
