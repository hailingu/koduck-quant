package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 社区信号实体
 */
@Entity
@Table(name = "community_signals")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommunitySignal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "strategy_id")
    private Long strategyId;

    @Column(nullable = false, length = 20)
    private String symbol;

    @Column(name = "signal_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private SignalType signalType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "target_price", precision = 19, scale = 4)
    private BigDecimal targetPrice;

    @Column(name = "stop_loss", precision = 19, scale = 4)
    private BigDecimal stopLoss;

    @Column(name = "time_frame", length = 20)
    private String timeFrame;

    private Integer confidence;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Status status;

    @Column(name = "result_status", length = 20)
    @Enumerated(EnumType.STRING)
    private ResultStatus resultStatus;

    @Column(name = "result_profit", precision = 19, scale = 4)
    private BigDecimal resultProfit;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "like_count")
    @Builder.Default
    private Integer likeCount = 0;

    @Column(name = "favorite_count")
    @Builder.Default
    private Integer favoriteCount = 0;

    @Column(name = "subscribe_count")
    @Builder.Default
    private Integer subscribeCount = 0;

    @Column(name = "comment_count")
    @Builder.Default
    private Integer commentCount = 0;

    @Column(name = "view_count")
    @Builder.Default
    private Integer viewCount = 0;

    @Column(name = "is_featured")
    @Builder.Default
    private Boolean isFeatured = false;

    @Column(columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> tags;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // 关联用户（非强制加载）
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 信号类型枚举
     */
    public enum SignalType {
        BUY,   // 买入
        SELL,  // 卖出
        HOLD   // 持有
    }

    /**
     * 信号状态枚举
     */
    public enum Status {
        ACTIVE,     // 活跃
        CLOSED,     // 已关闭
        EXPIRED,    // 已过期
        CANCELLED   // 已取消
    }

    /**
     * 结果状态枚举
     */
    public enum ResultStatus {
        PENDING,     // 等待中
        HIT_TARGET,  // 达到目标价
        HIT_STOP,    // 触及止损价
        TIMEOUT      // 超时
    }
}
