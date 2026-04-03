package com.koduck.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Synthetic tick history generated from realtime snapshots.
 *
 * @author Koduck
 */
@Entity
@Table(name = "stock_tick_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockTickHistory {

    /**
     * Unique identifier.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Stock symbol.
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * Tick timestamp.
     */
    @Column(name = "tick_time", nullable = false)
    private LocalDateTime tickTime;

    /**
     * Stock price.
     */
    @Column(name = "price", precision = 18, scale = 4, nullable = false)
    private BigDecimal price;

    /**
     * Trading volume.
     */
    @Column(name = "volume")
    private Long volume;

    /**
     * Trading amount.
     */
    @Column(name = "amount", precision = 24, scale = 2)
    private BigDecimal amount;

    /**
     * Creation timestamp.
     */
    @Column(name = "created_at")
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
