package com.koduck.entity.market;

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
 * 从实时快照生成的合成分时成交历史。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "stock_tick_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockTickHistory {

    /**
     * 唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 股票代码。
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * 分时时间戳。
     */
    @Column(name = "tick_time", nullable = false)
    private LocalDateTime tickTime;

    /**
     * 股票价格。
     */
    @Column(name = "price", precision = 18, scale = 4, nullable = false)
    private BigDecimal price;

    /**
     * 交易量。
     */
    @Column(name = "volume")
    private Long volume;

    /**
     * 交易额。
     */
    @Column(name = "amount", precision = 24, scale = 2)
    private BigDecimal amount;

    /**
     * 创建时间戳。
     */
    @Column(name = "created_at")
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
