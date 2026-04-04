package com.koduck.entity.portfolio;

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
 * 自选股项目实体，用于用户股票跟踪。
 * 表示用户在自选股中跟踪的股票代码。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "watchlist_items",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_watchlist_user_symbol",
           columnNames = {"user_id", "market", "symbol"}
       ),
       indexes = {
           @Index(name = "idx_watchlist_user", columnList = "user_id"),
           @Index(name = "idx_watchlist_symbol", columnList = "market, symbol"),
           @Index(name = "idx_watchlist_sort", columnList = "user_id, sort_order")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchlistItem {

    /**
     * 自选股项目的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 此自选股项目所有者的用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 市场代码（例如："AShare"）。
     */
    @Column(name = "market", nullable = false, length = 20)
    private String market;

    /**
     * 股票代码。
     */
    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    /**
     * 股票显示名称。
     */
    @Column(name = "name", length = 100)
    private String name;

    /**
     * 自选股中项目显示排序顺序。
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    /**
     * 此自选股项目的用户备注。
     */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /**
     * 项目创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 项目最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
