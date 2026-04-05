package com.koduck.entity.portfolio;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;

import org.hibernate.annotations.CreationTimestamp;

import com.koduck.entity.portfolio.TradeType;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * 基础交易实体，定义所有交易类型的公共字段。
 * 提取以消除 Trade 和 BacktestTrade 之间的冗余。
 *
 * @author Koduck Team
 */
@MappedSuperclass
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public abstract class BaseTrade {

    /** 交易类型（买入或卖出）。 */
    @Column(name = "trade_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private TradeType tradeType;

    /** 交易的股票代码。 */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /** 每股交易价格。 */
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    /** 交易股数。 */
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** 交易总金额（价格 * 数量）。 */
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    /** 交易发生时间戳。 */
    @Column(name = "trade_time", nullable = false)
    private LocalDateTime tradeTime;

    /** 记录创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
