package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import com.koduck.util.EntityCopyUtils;
import jakarta.persistence.*;
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
 * 
 */
@Entity
@Table(name = "community_signals")
@Data
@NoArgsConstructor
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
    private String timeframe;

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
    private Integer likeCount = 0;

    @Column(name = "favorite_count")
    private Integer favoriteCount = 0;

    @Column(name = "subscribe_count")
    private Integer subscribeCount = 0;

    @Column(name = "comment_count")
    private Integer commentCount = 0;

    @Column(name = "view_count")
    private Integer viewCount = 0;

    @Column(name = "is_featured")
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

    // （）
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private Long userId;
        private Long strategyId;
        private String symbol;
        private SignalType signalType;
        private String reason;
        private BigDecimal targetPrice;
        private BigDecimal stopLoss;
        private String timeFrame;
        private Integer confidence;
        private Status status;
        private ResultStatus resultStatus;
        private BigDecimal resultProfit;
        private LocalDateTime expiresAt;
        private Integer likeCount;
        private Integer favoriteCount;
        private Integer subscribeCount;
        private Integer commentCount;
        private Integer viewCount;
        private Boolean isFeatured;
        private List<String> tags;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private User user;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder strategyId(Long strategyId) { this.strategyId = strategyId; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder signalType(SignalType signalType) { this.signalType = signalType; return this; }
        public Builder reason(String reason) { this.reason = reason; return this; }
        public Builder targetPrice(BigDecimal targetPrice) { this.targetPrice = targetPrice; return this; }
        public Builder stopLoss(BigDecimal stopLoss) { this.stopLoss = stopLoss; return this; }
        public Builder timeFrame(String timeFrame) { this.timeFrame = timeFrame; return this; }
        public Builder confidence(Integer confidence) { this.confidence = confidence; return this; }
        public Builder status(Status status) { this.status = status; return this; }
        public Builder resultStatus(ResultStatus resultStatus) { this.resultStatus = resultStatus; return this; }
        public Builder resultProfit(BigDecimal resultProfit) { this.resultProfit = resultProfit; return this; }
        public Builder expiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; return this; }
        public Builder likeCount(Integer likeCount) { this.likeCount = likeCount; return this; }
        public Builder favoriteCount(Integer favoriteCount) { this.favoriteCount = favoriteCount; return this; }
        public Builder subscribeCount(Integer subscribeCount) { this.subscribeCount = subscribeCount; return this; }
        public Builder commentCount(Integer commentCount) { this.commentCount = commentCount; return this; }
        public Builder viewCount(Integer viewCount) { this.viewCount = viewCount; return this; }
        public Builder isFeatured(Boolean isFeatured) { this.isFeatured = isFeatured; return this; }
        public Builder tags(List<String> tags) { this.tags = CollectionCopyUtils.copyList(tags); return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }
        public Builder user(User user) { this.user = EntityCopyUtils.copyUser(user); return this; }

        public CommunitySignal build() {
            CommunitySignal signal = new CommunitySignal();
            signal.setId(id);
            signal.setUserId(userId);
            signal.setStrategyId(strategyId);
            signal.setSymbol(symbol);
            signal.setSignalType(signalType);
            signal.setReason(reason);
            signal.setTargetPrice(targetPrice);
            signal.setStopLoss(stopLoss);
            signal.setTimeframe(timeFrame);
            signal.setConfidence(confidence);
            signal.setStatus(status);
            signal.setResultStatus(resultStatus);
            signal.setResultProfit(resultProfit);
            signal.setExpiresAt(expiresAt);
            signal.setLikeCount(likeCount);
            signal.setFavoriteCount(favoriteCount);
            signal.setSubscribeCount(subscribeCount);
            signal.setCommentCount(commentCount);
            signal.setViewCount(viewCount);
            signal.setIsFeatured(isFeatured);
            signal.setTags(tags);
            signal.setCreatedAt(createdAt);
            signal.setUpdatedAt(updatedAt);
            signal.setUser(user);
            return signal;
        }
    }

    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }

    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * 
     */
    public enum SignalType {
        BUY,   // 
        SELL,  // 
        HOLD   // 
    }

    /**
     * 
     */
    public enum Status {
        ACTIVE,     // 
        CLOSED,     // 
        EXPIRED,    // 
        CANCELLED   // 
    }

    /**
     * 
     */
    public enum ResultStatus {
        PENDING,     // 
        HIT_TARGET,  // 
        HIT_STOP,    // 
        TIMEOUT      // 
    }
}
