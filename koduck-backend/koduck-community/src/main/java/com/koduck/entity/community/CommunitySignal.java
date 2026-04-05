package com.koduck.entity.community;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.entity.auth.User;
import com.koduck.util.CollectionCopyUtils;
import com.koduck.util.EntityCopyUtils;
import com.koduck.util.CommunityEntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 社区信号实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "community_signals")
@Data
@NoArgsConstructor
public class CommunitySignal {

    /**
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 策略 ID。
     */
    @Column(name = "strategy_id")
    private Long strategyId;

    /**
     * 股票代码。
     */
    @Column(nullable = false, length = 20)
    private String symbol;

    /**
     * 信号类型。
     */
    @Column(name = "signal_type", nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private SignalType signalType;

    /**
     * 信号原因。
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    /**
     * 目标价格。
     */
    @Column(name = "target_price", precision = 19, scale = 4)
    private BigDecimal targetPrice;

    /**
     * 止损价格。
     */
    @Column(name = "stop_loss", precision = 19, scale = 4)
    private BigDecimal stopLoss;

    /**
     * 时间框架。
     */
    @Column(name = "time_frame", length = 20)
    private String timeframe;

    /**
     * 置信度。
     */
    private Integer confidence;

    /**
     * 信号状态。
     */
    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Status status;

    /**
     * 结果状态。
     */
    @Column(name = "result_status", length = 20)
    @Enumerated(EnumType.STRING)
    private ResultStatus resultStatus;

    /**
     * 结果收益。
     */
    @Column(name = "result_profit", precision = 19, scale = 4)
    private BigDecimal resultProfit;

    /**
     * 过期时间。
     */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /**
     * 点赞数。
     */
    @Column(name = "like_count")
    private Integer likeCount = 0;

    /**
     * 收藏数。
     */
    @Column(name = "favorite_count")
    private Integer favoriteCount = 0;

    /**
     * 订阅数。
     */
    @Column(name = "subscribe_count")
    private Integer subscribeCount = 0;

    /**
     * 评论数。
     */
    @Column(name = "comment_count")
    private Integer commentCount = 0;

    /**
     * 浏览数。
     */
    @Column(name = "view_count")
    private Integer viewCount = 0;

    /**
     * 精选标志。
     */
    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    /**
     * 标签列表。
     */
    @Column(columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> tags;

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 更新时间。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 用户实体。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 创建新的构建器。
     *
     * @return 构建器实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * CommunitySignal 的构建器类。
     */
    public static final class Builder {

        /**
         * ID。
         */
        private Long id;

        /**
         * 用户 ID。
         */
        private Long userId;

        /**
         * 策略 ID。
         */
        private Long strategyId;

        /**
         * 股票代码。
         */
        private String symbol;

        /**
         * 信号类型。
         */
        private SignalType signalType;

        /**
         * 信号原因。
         */
        private String reason;

        /**
         * 目标价格。
         */
        private BigDecimal targetPrice;

        /**
         * 止损价格。
         */
        private BigDecimal stopLoss;

        /**
         * 时间框架。
         */
        private String timeFrame;

        /**
         * 置信度。
         */
        private Integer confidence;

        /**
         * 信号状态。
         */
        private Status status;

        /**
         * 结果状态。
         */
        private ResultStatus resultStatus;

        /**
         * 结果收益。
         */
        private BigDecimal resultProfit;

        /**
         * 过期时间。
         */
        private LocalDateTime expiresAt;

        /**
         * 点赞数。
         */
        private Integer likeCount;

        /**
         * 收藏数。
         */
        private Integer favoriteCount;

        /**
         * 订阅数。
         */
        private Integer subscribeCount;

        /**
         * 评论数。
         */
        private Integer commentCount;

        /**
         * 浏览数。
         */
        private Integer viewCount;

        /**
         * 精选标志。
         */
        private Boolean isFeatured;

        /**
         * 标签列表。
         */
        private List<String> tags;

        /**
         * 创建时间戳。
         */
        private LocalDateTime createdAt;

        /**
         * 更新时间戳。
         */
        private LocalDateTime updatedAt;

        /**
         * 用户实体。
         */
        private User user;

        /**
         * 设置 ID。
         *
         * @param id ID
         * @return 此构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 此构建器
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置策略 ID。
         *
         * @param strategyId 策略 ID
         * @return 此构建器
         */
        public Builder strategyId(Long strategyId) {
            this.strategyId = strategyId;
            return this;
        }

        /**
         * 设置股票代码。
         *
         * @param symbol 股票代码
         * @return 此构建器
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * 设置信号类型。
         *
         * @param signalType 信号类型
         * @return 此构建器
         */
        public Builder signalType(SignalType signalType) {
            this.signalType = signalType;
            return this;
        }

        /**
         * 设置原因。
         *
         * @param reason 原因
         * @return 此构建器
         */
        public Builder reason(String reason) {
            this.reason = reason;
            return this;
        }

        /**
         * 设置目标价格。
         *
         * @param targetPrice 目标价格
         * @return 此构建器
         */
        public Builder targetPrice(BigDecimal targetPrice) {
            this.targetPrice = targetPrice;
            return this;
        }

        /**
         * 设置止损。
         *
         * @param stopLoss 止损
         * @return 此构建器
         */
        public Builder stopLoss(BigDecimal stopLoss) {
            this.stopLoss = stopLoss;
            return this;
        }

        /**
         * 设置时间框架。
         *
         * @param timeFrame 时间框架
         * @return 此构建器
         */
        public Builder timeFrame(String timeFrame) {
            this.timeFrame = timeFrame;
            return this;
        }

        /**
         * 设置置信度。
         *
         * @param confidence 置信度
         * @return 此构建器
         */
        public Builder confidence(Integer confidence) {
            this.confidence = confidence;
            return this;
        }

        /**
         * 设置状态。
         *
         * @param status 状态
         * @return 此构建器
         */
        public Builder status(Status status) {
            this.status = status;
            return this;
        }

        /**
         * 设置结果状态。
         *
         * @param resultStatus 结果状态
         * @return 此构建器
         */
        public Builder resultStatus(ResultStatus resultStatus) {
            this.resultStatus = resultStatus;
            return this;
        }

        /**
         * 设置结果收益。
         *
         * @param resultProfit 结果收益
         * @return 此构建器
         */
        public Builder resultProfit(BigDecimal resultProfit) {
            this.resultProfit = resultProfit;
            return this;
        }

        /**
         * 设置过期时间。
         *
         * @param expiresAt 过期时间
         * @return 此构建器
         */
        public Builder expiresAt(LocalDateTime expiresAt) {
            this.expiresAt = expiresAt;
            return this;
        }

        /**
         * 设置点赞数。
         *
         * @param likeCount 点赞数
         * @return 此构建器
         */
        public Builder likeCount(Integer likeCount) {
            this.likeCount = likeCount;
            return this;
        }

        /**
         * 设置收藏数。
         *
         * @param favoriteCount 收藏数
         * @return 此构建器
         */
        public Builder favoriteCount(Integer favoriteCount) {
            this.favoriteCount = favoriteCount;
            return this;
        }

        /**
         * 设置订阅数。
         *
         * @param subscribeCount 订阅数
         * @return 此构建器
         */
        public Builder subscribeCount(Integer subscribeCount) {
            this.subscribeCount = subscribeCount;
            return this;
        }

        /**
         * 设置评论数。
         *
         * @param commentCount 评论数
         * @return 此构建器
         */
        public Builder commentCount(Integer commentCount) {
            this.commentCount = commentCount;
            return this;
        }

        /**
         * 设置浏览数。
         *
         * @param viewCount 浏览数
         * @return 此构建器
         */
        public Builder viewCount(Integer viewCount) {
            this.viewCount = viewCount;
            return this;
        }

        /**
         * 设置精选标志。
         *
         * @param isFeatured 精选标志
         * @return 此构建器
         */
        public Builder isFeatured(Boolean isFeatured) {
            this.isFeatured = isFeatured;
            return this;
        }

        /**
         * 设置标签。
         *
         * @param tags 标签
         * @return 此构建器
         */
        public Builder tags(List<String> tags) {
            this.tags = CollectionCopyUtils.copyList(tags);
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return 此构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAt 更新时间
         * @return 此构建器
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 设置用户。
         *
         * @param user 用户
         * @return 此构建器
         */
        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * 构建 CommunitySignal。
         *
         * @return CommunitySignal
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
     * 获取标签副本。
     *
     * @return 标签副本
     */
    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    /**
     * 使用副本设置标签。
     *
     * @param tags 标签
     */
    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }

    /**
     * 获取用户副本。
     *
     * @return 用户副本
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * 使用副本设置用户。
     *
     * @param user 用户
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * 信号类型枚举。
     */
    public enum SignalType {

        /**
         * 买入信号。
         */
        BUY,

        /**
         * 卖出信号。
         */
        SELL,

        /**
         * 持有信号。
         */
        HOLD
    }

    /**
     * 状态枚举。
     */
    public enum Status {

        /**
         * 活跃状态。
         */
        ACTIVE,

        /**
         * 已关闭状态。
         */
        CLOSED,

        /**
         * 已过期状态。
         */
        EXPIRED,

        /**
         * 已取消状态。
         */
        CANCELLED
    }

    /**
     * 结果状态枚举。
     */
    public enum ResultStatus {

        /**
         * 结果待处理。
         */
        PENDING,

        /**
         * 达到目标。
         */
        HIT_TARGET,

        /**
         * 达到止损。
         */
        HIT_STOP,

        /**
         * 超时。
         */
        TIMEOUT
    }
}
