package com.koduck.entity.market;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.koduck.common.constants.MarketConstants;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 股票实时行情实体，映射到 PostgreSQL 的 stock_realtime 表。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "stock_realtime")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockRealtime {

    /**
     * 股票代码（股票代码）。
     */
    @Id
    @Column(name = "symbol", length = 20)
    private String symbol;

    /**
     * 股票名称。
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 股票类型：STOCK 或 INDEX。
     */
    @Column(name = "type", nullable = false, length = 10)
    @Builder.Default
    private String type = MarketConstants.STOCK_TYPE;

    /**
     * 当前价格。
     */
    @Column(name = "price", precision = 18, scale = 4)
    private BigDecimal price;

    /**
     * 开盘价。
     */
    @Column(name = "open_price", precision = 18, scale = 4)
    private BigDecimal openPrice;

    /**
     * 当日最高价。
     */
    @Column(name = "high", precision = 18, scale = 4)
    private BigDecimal high;

    /**
     * 当日最低价。
     */
    @Column(name = "low", precision = 18, scale = 4)
    private BigDecimal low;

    /**
     * 昨日收盘价。
     */
    @Column(name = "prev_close", precision = 18, scale = 4)
    private BigDecimal prevClose;

    /**
     * 成交量。
     */
    @Column(name = "volume")
    private Long volume;

    /**
     * 成交金额。
     */
    @Column(name = "amount", precision = 24, scale = 2)
    private BigDecimal amount;

    /**
     * 价格变动金额。
     */
    @Column(name = "change_amount", precision = 18, scale = 4)
    private BigDecimal changeAmount;

    /**
     * 价格变动百分比。
     */
    @Column(name = "change_percent", precision = 10, scale = 4)
    private BigDecimal changePercent;

    /**
     * 买入价格。
     */
    @Column(name = "bid_price", precision = 18, scale = 4)
    private BigDecimal bidPrice;

    /**
     * 买入量。
     */
    @Column(name = "bid_volume")
    private Long bidVolume;

    /**
     * 卖出价格。
     */
    @Column(name = "ask_price", precision = 18, scale = 4)
    private BigDecimal askPrice;

    /**
     * 卖出量。
     */
    @Column(name = "ask_volume")
    private Long askVolume;

    /**
     * 最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
