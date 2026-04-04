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

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Stock basic information entity.
 * Maps to stock_basic table in PostgreSQL.
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
     * Primary key.
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
     * Stock type (STOCK or INDEX).
     */
    @Column(name = "type", nullable = false, length = 10)
    @Builder.Default
    private String type = "STOCK";

    /**
     * Stock name.
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * Market code.
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * Board type.
     */
    @Column(name = "board", length = 20)
    private String board;

    /**
     * Industry classification.
     */
    @Column(name = "industry", length = 100)
    private String industry;

    /**
     * Sector classification.
     */
    @Column(name = "sector", length = 100)
    private String sector;

    /**
     * Sub-industry classification.
     */
    @Column(name = "sub_industry", length = 100)
    private String subIndustry;

    /**
     * Province.
     */
    @Column(name = "province", length = 50)
    private String province;

    /**
     * City.
     */
    @Column(name = "city", length = 50)
    private String city;

    /**
     * Total shares.
     */
    @Column(name = "total_shares")
    private Long totalShares;

    /**
     * Float shares.
     */
    @Column(name = "float_shares")
    private Long floatShares;

    /**
     * Float ratio.
     */
    @Column(name = "float_ratio", precision = 5, scale = 4)
    private BigDecimal floatRatio;

    /**
     * Stock status.
     */
    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "Active";

    /**
     * Whether the stock is in Shanghai-Hong Kong Stock Connect.
     */
    @Column(name = "is_shanghai_hongkong")
    @Builder.Default
    private Boolean isShanghaiHongkong = false;

    /**
     * Whether the stock is in Shenzhen-Hong Kong Stock Connect.
     */
    @Column(name = "is_shenzhen_hongkong")
    @Builder.Default
    private Boolean isShenzhenHongkong = false;

    /**
     * Stock type (A, B, etc.).
     */
    @Column(name = "stock_type", length = 20)
    @Builder.Default
    private String stockType = "A";

    /**
     * Listing date.
     */
    @Column(name = "list_date")
    private LocalDate listDate;

    /**
     * Delisting date.
     */
    @Column(name = "delist_date")
    private LocalDate delistDate;

    /**
     * Whether the stock is a constituent of HS300.
     */
    @Column(name = "is_hs")
    @Builder.Default
    private Boolean isHs = false;

    /**
     * Price-to-earnings ratio (TTM).
     */
    @Column(name = "pe_ttm", precision = 12, scale = 4)
    private BigDecimal peTtm;

    /**
     * Price-to-book ratio.
     */
    @Column(name = "pb", precision = 12, scale = 4)
    private BigDecimal pb;

    /**
     * Price-to-sales ratio (TTM).
     */
    @Column(name = "ps_ttm", precision = 12, scale = 4)
    private BigDecimal psTtm;

    /**
     * Market capitalization.
     */
    @Column(name = "market_cap", precision = 18, scale = 2)
    private BigDecimal marketCap;

    /**
     * Float market capitalization.
     */
    @Column(name = "float_market_cap", precision = 18, scale = 2)
    private BigDecimal floatMarketCap;

    /**
     * Turnover rate.
     */
    @Column(name = "turnover_rate", precision = 10, scale = 4)
    private BigDecimal turnoverRate;

    /**
     * Creation timestamp.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Last update timestamp.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
