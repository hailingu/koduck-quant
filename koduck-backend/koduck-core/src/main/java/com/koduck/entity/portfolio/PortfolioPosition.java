package com.koduck.entity.portfolio;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
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
 * 投资组合持仓实体，表示用户的股票持仓。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "portfolio_positions",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_portfolio_user_symbol",
           columnNames = {"user_id", "market", "symbol"}
       ),
       indexes = {
           @Index(name = "idx_portfolio_user", columnList = "user_id"),
           @Index(name = "idx_portfolio_symbol", columnList = "market, symbol")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioPosition {

    /** 持仓的唯一标识符。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 持仓所有者的用户 ID。 */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 市场标识符（例如：AShare、US）。 */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /** 股票代码。 */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /** 股票名称。 */
    @Column(name = "name", length = 100)
    private String name;

    /** 持有股数。 */
    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** 每股平均成本。 */
    @Column(name = "avg_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal avgCost;

    /** 持仓创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** 最后更新时间戳。 */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
