package com.koduck.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Trade entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "trades",
       indexes = {
           @Index(name = "idx_trade_user", columnList = "user_id"),
           @Index(name = "idx_trade_symbol", columnList = "market, symbol"),
           @Index(name = "idx_trade_time", columnList = "trade_time")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Trade {

    /** The ID. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** The user ID. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** The market. */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /** The symbol. */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /** The name. */
    @Column(name = "name", length = 100)
    private String name;

    /** The trade type. */
    @Column(name = "trade_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private TradeType tradeType;

    /** The quantity. */
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** The price. */
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    /** The amount. */
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    /** The trade time. */
    @Column(name = "trade_time", nullable = false)
    private LocalDateTime tradeTime;

    /** The created at timestamp. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** The status. */
    @Column(name = "status", length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TradeStatus status = TradeStatus.SUCCESS;

    /** The notes. */
    @Column(name = "notes", length = 500)
    private String notes;

    /**
     * Trade type enum.
     */
    public enum TradeType {

        /** Buy trade. */
        BUY,

        /** Sell trade. */
        SELL
    }

    /**
     * Trade status enum.
     */
    public enum TradeStatus {

        /** Pending status. */
        PENDING,

        /** Success status. */
        SUCCESS,

        /** Failed status. */
        FAILED,

        /** Cancelled status. */
        CANCELLED
    }
}
