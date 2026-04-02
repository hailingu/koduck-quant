package com.koduck.entity;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;
import com.koduck.util.EntityCopyUtils;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Community signal entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "community_signals")
@Data
@NoArgsConstructor
public class CommunitySignal {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Strategy ID.
     */
    @Column(name = "strategy_id")
    private Long strategyId;

    /**
     * Stock symbol.
     */
    @Column(nullable = false, length = 20)
    private String symbol;

    /**
     * Signal type.
     */
    @Column(name = "signal_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private SignalType signalType;

    /**
     * Signal reason.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    /**
     * Target price.
     */
    @Column(name = "target_price", precision = 19, scale = 4)
    private BigDecimal targetPrice;

    /**
     * Stop loss price.
     */
    @Column(name = "stop_loss", precision = 19, scale = 4)
    private BigDecimal stopLoss;

    /**
     * Time frame.
     */
    @Column(name = "time_frame", length = 20)
    private String timeframe;

    /**
     * Confidence level.
     */
    private Integer confidence;

    /**
     * Signal status.
     */
    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Status status;

    /**
     * Result status.
     */
    @Column(name = "result_status", length = 20)
    @Enumerated(EnumType.STRING)
    private ResultStatus resultStatus;

    /**
     * Result profit.
     */
    @Column(name = "result_profit", precision = 19, scale = 4)
    private BigDecimal resultProfit;

    /**
     * Expiration time.
     */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /**
     * Like count.
     */
    @Column(name = "like_count")
    private Integer likeCount = 0;

    /**
     * Favorite count.
     */
    @Column(name = "favorite_count")
    private Integer favoriteCount = 0;

    /**
     * Subscribe count.
     */
    @Column(name = "subscribe_count")
    private Integer subscribeCount = 0;

    /**
     * Comment count.
     */
    @Column(name = "comment_count")
    private Integer commentCount = 0;

    /**
     * View count.
     */
    @Column(name = "view_count")
    private Integer viewCount = 0;

    /**
     * Featured flag.
     */
    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    /**
     * Tags list.
     */
    @Column(columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> tags;

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Updated at.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * User entity.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Creates a new builder.
     *
     * @return Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for CommunitySignal.
     */
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

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return this builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the user ID.
         *
         * @param userId the user ID
         * @return this builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Sets the strategy ID.
         *
         * @param strategyId the strategy ID
         * @return this builder
         */
        public Builder strategyId(Long strategyId) {
            this.strategyId = strategyId;
            return this;
        }

        /**
         * Sets the symbol.
         *
         * @param symbol the symbol
         * @return this builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Sets the signal type.
         *
         * @param signalType the signal type
         * @return this builder
         */
        public Builder signalType(SignalType signalType) {
            this.signalType = signalType;
            return this;
        }

        /**
         * Sets the reason.
         *
         * @param reason the reason
         * @return this builder
         */
        public Builder reason(String reason) {
            this.reason = reason;
            return this;
        }

        /**
         * Sets the target price.
         *
         * @param targetPrice the target price
         * @return this builder
         */
        public Builder targetPrice(BigDecimal targetPrice) {
            this.targetPrice = targetPrice;
            return this;
        }

        /**
         * Sets the stop loss.
         *
         * @param stopLoss the stop loss
         * @return this builder
         */
        public Builder stopLoss(BigDecimal stopLoss) {
            this.stopLoss = stopLoss;
            return this;
        }

        /**
         * Sets the time frame.
         *
         * @param timeFrame the time frame
         * @return this builder
         */
        public Builder timeFrame(String timeFrame) {
            this.timeFrame = timeFrame;
            return this;
        }

        /**
         * Sets the confidence.
         *
         * @param confidence the confidence
         * @return this builder
         */
        public Builder confidence(Integer confidence) {
            this.confidence = confidence;
            return this;
        }

        /**
         * Sets the status.
         *
         * @param status the status
         * @return this builder
         */
        public Builder status(Status status) {
            this.status = status;
            return this;
        }

        /**
         * Sets the result status.
         *
         * @param resultStatus the result status
         * @return this builder
         */
        public Builder resultStatus(ResultStatus resultStatus) {
            this.resultStatus = resultStatus;
            return this;
        }

        /**
         * Sets the result profit.
         *
         * @param resultProfit the result profit
         * @return this builder
         */
        public Builder resultProfit(BigDecimal resultProfit) {
            this.resultProfit = resultProfit;
            return this;
        }

        /**
         * Sets the expires at.
         *
         * @param expiresAt the expires at
         * @return this builder
         */
        public Builder expiresAt(LocalDateTime expiresAt) {
            this.expiresAt = expiresAt;
            return this;
        }

        /**
         * Sets the like count.
         *
         * @param likeCount the like count
         * @return this builder
         */
        public Builder likeCount(Integer likeCount) {
            this.likeCount = likeCount;
            return this;
        }

        /**
         * Sets the favorite count.
         *
         * @param favoriteCount the favorite count
         * @return this builder
         */
        public Builder favoriteCount(Integer favoriteCount) {
            this.favoriteCount = favoriteCount;
            return this;
        }

        /**
         * Sets the subscribe count.
         *
         * @param subscribeCount the subscribe count
         * @return this builder
         */
        public Builder subscribeCount(Integer subscribeCount) {
            this.subscribeCount = subscribeCount;
            return this;
        }

        /**
         * Sets the comment count.
         *
         * @param commentCount the comment count
         * @return this builder
         */
        public Builder commentCount(Integer commentCount) {
            this.commentCount = commentCount;
            return this;
        }

        /**
         * Sets the view count.
         *
         * @param viewCount the view count
         * @return this builder
         */
        public Builder viewCount(Integer viewCount) {
            this.viewCount = viewCount;
            return this;
        }

        /**
         * Sets the featured flag.
         *
         * @param isFeatured the featured flag
         * @return this builder
         */
        public Builder isFeatured(Boolean isFeatured) {
            this.isFeatured = isFeatured;
            return this;
        }

        /**
         * Sets the tags.
         *
         * @param tags the tags
         * @return this builder
         */
        public Builder tags(List<String> tags) {
            this.tags = CollectionCopyUtils.copyList(tags);
            return this;
        }

        /**
         * Sets the created at.
         *
         * @param createdAt the created at
         * @return this builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at.
         *
         * @param updatedAt the updated at
         * @return this builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Sets the user.
         *
         * @param user the user
         * @return this builder
         */
        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * Builds the CommunitySignal.
         *
         * @return the CommunitySignal
         */
        public CommunitySignal build() {
            CommunitySignal signal = new CommunitySignal();
            signal.id = id;
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
            signal.createdAt = createdAt;
            signal.setUpdatedAt(updatedAt);
            signal.setUser(user);
            return signal;
        }
    }

    /**
     * Gets tags copy.
     *
     * @return tags copy
     */
    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    /**
     * Sets tags with copy.
     *
     * @param tags the tags
     */
    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }

    /**
     * Gets user copy.
     *
     * @return user copy
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * Sets user with copy.
     *
     * @param user the user
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * Signal type enum.
     */
    public enum SignalType {

        /**
         * Buy signal.
         */
        BUY,

        /**
         * Sell signal.
         */
        SELL,

        /**
         * Hold signal.
         */
        HOLD
    }

    /**
     * Status enum.
     */
    public enum Status {

        /**
         * Active status.
         */
        ACTIVE,

        /**
         * Closed status.
         */
        CLOSED,

        /**
         * Expired status.
         */
        EXPIRED,

        /**
         * Cancelled status.
         */
        CANCELLED
    }

    /**
     * Result status enum.
     */
    public enum ResultStatus {

        /**
         * Pending result.
         */
        PENDING,

        /**
         * Hit target.
         */
        HIT_TARGET,

        /**
         * Hit stop.
         */
        HIT_STOP,

        /**
         * Timeout.
         */
        TIMEOUT
    }
}
