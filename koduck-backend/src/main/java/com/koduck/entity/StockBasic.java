package com.koduck.entity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Stock basic information entity.
 * Maps to stock_basic table in PostgreSQL.
 */
@Entity
@Table(name = "stock_basic", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"symbol", "type"}, name = "uk_stock_basic_symbol_type"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockBasic {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;
    
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;
    
    @Column(name = "type", nullable = false, length = 10)
    @Builder.Default
    private String type = "STOCK"; // STOCK or INDEX
    
    @Column(name = "name", nullable = false, length = 100)
    private String name;
    
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    @Column(name = "board", length = 20)
    private String board;

    @Column(name = "industry", length = 100)
    private String industry;

    @Column(name = "sector", length = 100)
    private String sector;

    @Column(name = "sub_industry", length = 100)
    private String subIndustry;

    @Column(name = "province", length = 50)
    private String province;

    @Column(name = "city", length = 50)
    private String city;

    @Column(name = "total_shares")
    private Long totalShares;

    @Column(name = "float_shares")
    private Long floatShares;

    @Column(name = "float_ratio", precision = 5, scale = 4)
    private BigDecimal floatRatio;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "Active";

    @Column(name = "is_shanghai_hongkong")
    @Builder.Default
    private Boolean isShanghaiHongkong = false;

    @Column(name = "is_shenzhen_hongkong")
    @Builder.Default
    private Boolean isShenzhenHongkong = false;

    @Column(name = "stock_type", length = 20)
    @Builder.Default
    private String stockType = "A";
    
    @Column(name = "list_date")
    private LocalDate listDate;
    
    @Column(name = "delist_date")
    private LocalDate delistDate;
    
    @Column(name = "is_hs")
    @Builder.Default
    private Boolean isHs = false;

    @Column(name = "pe_ttm", precision = 12, scale = 4)
    private BigDecimal peTtm;

    @Column(name = "pb", precision = 12, scale = 4)
    private BigDecimal pb;

    @Column(name = "ps_ttm", precision = 12, scale = 4)
    private BigDecimal psTtm;

    @Column(name = "market_cap", precision = 18, scale = 2)
    private BigDecimal marketCap;

    @Column(name = "float_market_cap", precision = 18, scale = 2)
    private BigDecimal floatMarketCap;

    @Column(name = "turnover_rate", precision = 10, scale = 4)
    private BigDecimal turnoverRate;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
