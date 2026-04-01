package com.koduck.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Synthetic tick history generated from realtime snapshots.
 */
@Entity
@Table(name = "stock_tick_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockTickHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    @Column(name = "tick_time", nullable = false)
    private LocalDateTime tickTime;

    @Column(name = "price", precision = 18, scale = 4, nullable = false)
    private BigDecimal price;

    @Column(name = "volume")
    private Long volume;

    @Column(name = "amount", precision = 24, scale = 2)
    private BigDecimal amount;

    @Column(name = "created_at")
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}

