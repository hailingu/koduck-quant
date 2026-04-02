package com.koduck.dto.community;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.koduck.common.constants.DateTimePatternConstants;
import com.koduck.util.CollectionCopyUtils;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for signal response.
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class SignalResponse {

    /**
     * Signal ID.
     */
    private Long id;

    /**
     * User ID.
     */
    private Long userId;

    /**
     * Username.
     */
    private String username;

    /**
     * Avatar URL.
     */
    private String avatarUrl;

    /**
     * Strategy ID.
     */
    private Long strategyId;

    /**
     * Strategy name.
     */
    private String strategyName;

    /**
     * Stock symbol.
     */
    private String symbol;

    /**
     * Signal type.
     */
    private String signalType;

    /**
     * Signal reason.
     */
    private String reason;

    /**
     * Target price.
     */
    private BigDecimal targetPrice;

    /**
     * Stop loss price.
     */
    private BigDecimal stopLoss;

    /**
     * Time frame for the signal.
     */
    @JsonProperty("timeFrame")
    private String signalTimeFrame;

    /**
     * Confidence level (0-100).
     */
    private Integer confidence;

    /**
     * Signal status.
     */
    private String status;

    /**
     * Result status.
     */
    private String resultStatus;

    /**
     * Result profit.
     */
    private BigDecimal resultProfit;

    /**
     * Expiration time.
     */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime expiresAt;

    /**
     * Like count.
     */
    private Integer likeCount;

    /**
     * Favorite count.
     */
    private Integer favoriteCount;

    /**
     * Subscribe count.
     */
    private Integer subscribeCount;

    /**
     * Comment count.
     */
    private Integer commentCount;

    /**
     * View count.
     */
    private Integer viewCount;

    /**
     * Whether the signal is featured.
     */
    private Boolean isFeatured;

    /**
     * List of tags.
     */
    private List<String> tags;

    /**
     * Whether the current user has liked this signal.
     */
    private Boolean isLiked;

    /**
     * Whether the current user has favorited this signal.
     */
    private Boolean isFavorited;

    /**
     * Whether the current user has subscribed to this signal.
     */
    private Boolean isSubscribed;

    /**
     * Creation time.
     */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;

    /**
     * Last update time.
     */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime updatedAt;

    /**
     * Create a new builder.
     *
     * @return a new Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for SignalResponse.
     */
    public static final class Builder {

        private Long id;
        private Long userId;
        private String username;
        private String avatarUrl;
        private Long strategyId;
        private String strategyName;
        private String symbol;
        private String signalType;
        private String reason;
        private BigDecimal targetPrice;
        private BigDecimal stopLoss;
        private String signalTimeFrame;
        private Integer confidence;
        private String status;
        private String resultStatus;
        private BigDecimal resultProfit;
        private LocalDateTime expiresAt;
        private Integer likeCount;
        private Integer favoriteCount;
        private Integer subscribeCount;
        private Integer commentCount;
        private Integer viewCount;
        private Boolean isFeatured;
        private List<String> tags;
        private Boolean isLiked;
        private Boolean isFavorited;
        private Boolean isSubscribed;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        /**
         * Set the ID.
         *
         * @param id the ID
         * @return the builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Set the user ID.
         *
         * @param userId the user ID
         * @return the builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Set the username.
         *
         * @param username the username
         * @return the builder
         */
        public Builder username(String username) {
            this.username = username;
            return this;
        }

        /**
         * Set the avatar URL.
         *
         * @param avatarUrl the avatar URL
         * @return the builder
         */
        public Builder avatarUrl(String avatarUrl) {
            this.avatarUrl = avatarUrl;
            return this;
        }

        /**
         * Set the strategy ID.
         *
         * @param strategyId the strategy ID
         * @return the builder
         */
        public Builder strategyId(Long strategyId) {
            this.strategyId = strategyId;
            return this;
        }

        /**
         * Set the strategy name.
         *
         * @param strategyName the strategy name
         * @return the builder
         */
        public Builder strategyName(String strategyName) {
            this.strategyName = strategyName;
            return this;
        }

        /**
         * Set the symbol.
         *
         * @param symbol the symbol
         * @return the builder
         */
        public Builder symbol(String symbol) {
            this.symbol = symbol;
            return this;
        }

        /**
         * Set the signal type.
         *
         * @param signalType the signal type
         * @return the builder
         */
        public Builder signalType(String signalType) {
            this.signalType = signalType;
            return this;
        }

        /**
         * Set the reason.
         *
         * @param reason the reason
         * @return the builder
         */
        public Builder reason(String reason) {
            this.reason = reason;
            return this;
        }

        /**
         * Set the target price.
         *
         * @param targetPrice the target price
         * @return the builder
         */
        public Builder targetPrice(BigDecimal targetPrice) {
            this.targetPrice = targetPrice;
            return this;
        }

        /**
         * Set the stop loss.
         *
         * @param stopLoss the stop loss
         * @return the builder
         */
        public Builder stopLoss(BigDecimal stopLoss) {
            this.stopLoss = stopLoss;
            return this;
        }

        /**
         * Set the time frame.
         *
         * @param timeFrame the time frame
         * @return the builder
         */
        public Builder timeFrame(String timeFrame) {
            this.signalTimeFrame = timeFrame;
            return this;
        }

        /**
         * Set the confidence.
         *
         * @param confidence the confidence
         * @return the builder
         */
        public Builder confidence(Integer confidence) {
            this.confidence = confidence;
            return this;
        }

        /**
         * Set the status.
         *
         * @param status the status
         * @return the builder
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Set the result status.
         *
         * @param resultStatus the result status
         * @return the builder
         */
        public Builder resultStatus(String resultStatus) {
            this.resultStatus = resultStatus;
            return this;
        }

        /**
         * Set the result profit.
         *
         * @param resultProfit the result profit
         * @return the builder
         */
        public Builder resultProfit(BigDecimal resultProfit) {
            this.resultProfit = resultProfit;
            return this;
        }

        /**
         * Set the expiration time.
         *
         * @param expiresAt the expiration time
         * @return the builder
         */
        public Builder expiresAt(LocalDateTime expiresAt) {
            this.expiresAt = expiresAt;
            return this;
        }

        /**
         * Set the like count.
         *
         * @param likeCount the like count
         * @return the builder
         */
        public Builder likeCount(Integer likeCount) {
            this.likeCount = likeCount;
            return this;
        }

        /**
         * Set the favorite count.
         *
         * @param favoriteCount the favorite count
         * @return the builder
         */
        public Builder favoriteCount(Integer favoriteCount) {
            this.favoriteCount = favoriteCount;
            return this;
        }

        /**
         * Set the subscribe count.
         *
         * @param subscribeCount the subscribe count
         * @return the builder
         */
        public Builder subscribeCount(Integer subscribeCount) {
            this.subscribeCount = subscribeCount;
            return this;
        }

        /**
         * Set the comment count.
         *
         * @param commentCount the comment count
         * @return the builder
         */
        public Builder commentCount(Integer commentCount) {
            this.commentCount = commentCount;
            return this;
        }

        /**
         * Set the view count.
         *
         * @param viewCount the view count
         * @return the builder
         */
        public Builder viewCount(Integer viewCount) {
            this.viewCount = viewCount;
            return this;
        }

        /**
         * Set whether the signal is featured.
         *
         * @param isFeatured whether featured
         * @return the builder
         */
        public Builder isFeatured(Boolean isFeatured) {
            this.isFeatured = isFeatured;
            return this;
        }

        /**
         * Set the tags.
         *
         * @param tags the tags
         * @return the builder
         */
        public Builder tags(List<String> tags) {
            this.tags = CollectionCopyUtils.copyList(tags);
            return this;
        }

        /**
         * Set whether the signal is liked.
         *
         * @param isLiked whether liked
         * @return the builder
         */
        public Builder isLiked(Boolean isLiked) {
            this.isLiked = isLiked;
            return this;
        }

        /**
         * Set whether the signal is favorited.
         *
         * @param isFavorited whether favorited
         * @return the builder
         */
        public Builder isFavorited(Boolean isFavorited) {
            this.isFavorited = isFavorited;
            return this;
        }

        /**
         * Set whether the signal is subscribed.
         *
         * @param isSubscribed whether subscribed
         * @return the builder
         */
        public Builder isSubscribed(Boolean isSubscribed) {
            this.isSubscribed = isSubscribed;
            return this;
        }

        /**
         * Set the creation time.
         *
         * @param createdAt the creation time
         * @return the builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Set the update time.
         *
         * @param updatedAt the update time
         * @return the builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Build the SignalResponse.
         *
         * @return the SignalResponse
         */
        public SignalResponse build() {
            SignalResponse response = new SignalResponse();
            response.setId(id);
            response.setUserId(userId);
            response.setUsername(username);
            response.setAvatarUrl(avatarUrl);
            response.setStrategyId(strategyId);
            response.setStrategyName(strategyName);
            response.setSymbol(symbol);
            response.setSignalType(signalType);
            response.setReason(reason);
            response.setTargetPrice(targetPrice);
            response.setStopLoss(stopLoss);
            response.setSignalTimeFrame(signalTimeFrame);
            response.setConfidence(confidence);
            response.setStatus(status);
            response.setResultStatus(resultStatus);
            response.setResultProfit(resultProfit);
            response.setExpiresAt(expiresAt);
            response.setLikeCount(likeCount);
            response.setFavoriteCount(favoriteCount);
            response.setSubscribeCount(subscribeCount);
            response.setCommentCount(commentCount);
            response.setViewCount(viewCount);
            response.setIsFeatured(isFeatured);
            response.setTags(tags);
            response.setIsLiked(isLiked);
            response.setIsFavorited(isFavorited);
            response.setIsSubscribed(isSubscribed);
            response.setCreatedAt(createdAt);
            response.setUpdatedAt(updatedAt);
            return response;
        }
    }

    /**
     * Get tags with defensive copy.
     *
     * @return the tags list
     */
    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    /**
     * Set tags with defensive copy.
     *
     * @param tags the tags list
     */
    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }
}
