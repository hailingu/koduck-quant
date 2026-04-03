package com.koduck.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;

import org.hibernate.annotations.CreationTimestamp;

import com.koduck.entity.enums.TradeType;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * Base trade entity defining common fields for all trade types.
 * Extracted to eliminate redundancy between Trade and BacktestTrade.
 *
 * @author Koduck Team
 */
@MappedSuperclass
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public abstract class BaseTrade {

    /** Type of trade (BUY or SELL). */
    @Column(name = "trade_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private TradeType tradeType;

    /** Stock symbol traded. */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /** Trade price per share. */
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    /** Number of shares traded. */
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** Total trade amount (price * quantity). */
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    /** Timestamp when the trade occurred. */
    @Column(name = "trade_time", nullable = false)
    private LocalDateTime tradeTime;

    /** Timestamp when the record was created. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
