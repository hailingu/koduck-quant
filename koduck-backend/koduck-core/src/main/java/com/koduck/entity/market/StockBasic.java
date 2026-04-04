package com.koduck.entity.market;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

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
 * 股票基本信息实体，映射到 PostgreSQL 的 stock_basic 表。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "stock_basic",
       uniqueConstraints = @UniqueConstraint(columnNames = {"symbol", "type"}, name = "uk_stock_basic_symbol_type"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockBasic {

    /**
     * 主键。
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
     * 股票类型（STOCK 或 INDEX）。
     */
    @Column(name = "type", nullable = false, length = 10)
    @Builder.Default
    private String type = MarketConstants.STOCK_TYPE;

    /**
     * 股票名称。
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 市场代码。
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * 板块类型。
     */
    @Column(name = "board", length = 20)
    private String board;

    /**
     * 行业分类。
     */
    @Column(name = "industry", length = 100)
    private String industry;

    /**
     * 板块分类。
     */
    @Column(name = "sector", length = 100)
    private String sector;

    /**
     * 子行业分类。
     */
    @Column(name = "sub_industry", length = 100)
    private String subIndustry;

    /**
     * 省份。
     */
    @Column(name = "province", length = 50)
    private String province;

    /**
     * 城市。
     */
    @Column(name = "city", length = 50)
    private String city;

    /**
     * 总股本。
     */
    @Column(name = "total_shares")
    private Long totalShares;

    /**
     * 流通股本。
     */
    @Column(name = "float_shares")
    private Long floatShares;

    /**
     * 流通比例。
     */
    @Column(name = "float_ratio", precision = 5, scale = 4)
    private BigDecimal floatRatio;

    /**
     * 股票状态。
     */
    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "Active";

    /**
     * 是否为沪港通标的。
     */
    @Column(name = "is_shanghai_hongkong")
    @Builder.Default
    private Boolean isShanghaiHongkong = false;

    /**
     * 是否为深港通标的。
     */
    @Column(name = "is_shenzhen_hongkong")
    @Builder.Default
    private Boolean isShenzhenHongkong = false;

    /**
     * 股票类型（A、B 等）。
     */
    @Column(name = "stock_type", length = 20)
    @Builder.Default
    private String stockType = "A";

    /**
     * 上市日期。
     */
    @Column(name = "list_date")
    private LocalDate listDate;

    /**
     * 退市日期。
     */
    @Column(name = "delist_date")
    private LocalDate delistDate;

    /**
     * 是否为沪深 300 成分股。
     */
    @Column(name = "is_hs")
    @Builder.Default
    private Boolean isHs = false;

    /**
     * 市盈率（TTM）。
     */
    @Column(name = "pe_ttm", precision = 12, scale = 4)
    private BigDecimal peTtm;

    /**
     * 市净率。
     */
    @Column(name = "pb", precision = 12, scale = 4)
    private BigDecimal pb;

    /**
     * 市销率（TTM）。
     */
    @Column(name = "ps_ttm", precision = 12, scale = 4)
    private BigDecimal psTtm;

    /**
     * 市值。
     */
    @Column(name = "market_cap", precision = 18, scale = 2)
    private BigDecimal marketCap;

    /**
     * 流通市值。
     */
    @Column(name = "float_market_cap", precision = 18, scale = 2)
    private BigDecimal floatMarketCap;

    /**
     * 换手率。
     */
    @Column(name = "turnover_rate", precision = 10, scale = 4)
    private BigDecimal turnoverRate;

    /**
     * 创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
