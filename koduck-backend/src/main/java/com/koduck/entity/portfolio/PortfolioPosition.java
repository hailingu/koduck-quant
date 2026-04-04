package com.koduck.entity.portfolio;
import com.koduck.entity.auth.User;

import java.math.BigDecimal;
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
 * Portfolio position entity representing user's stock holdings.
 *
 * @author koduck
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

    /** Unique identifier for the position. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** User ID who owns this position. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Market identifier (e.g., AShare, US). */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /** Stock symbol code. */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /** Stock name. */
    @Column(name = "name", length = 100)
    private String name;

    /** Quantity of shares held. */
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** Average cost per share. */
    @Column(name = "avg_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal avgCost;

    /** Timestamp when position was created. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** Timestamp of last update. */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
