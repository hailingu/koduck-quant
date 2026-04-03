package com.koduck.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import com.koduck.entity.enums.TradeStatus;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

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
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class Trade extends BaseTrade {

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

    /** The name. */
    @Column(name = "name", length = 100)
    private String name;

    /** The status. */
    @Column(name = "status", length = 20)
    @Enumerated(EnumType.STRING)
    private TradeStatus status;

    /** The notes. */
    @Column(name = "notes", length = 500)
    private String notes;
}
