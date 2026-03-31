package com.koduck.dto.community;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.koduck.common.constants.DateTimePatternConstants;
import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class SignalResponse {

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
    @JsonProperty("timeFrame")
    private String signalTimeFrame;
    private Integer confidence;

    private String status;
    private String resultStatus;
    private BigDecimal resultProfit;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime expiresAt;

    private Integer likeCount;
    private Integer favoriteCount;
    private Integer subscribeCount;
    private Integer commentCount;
    private Integer viewCount;

    private Boolean isFeatured;
    private List<String> tags;

    // 
    private Boolean isLiked;
    private Boolean isFavorited;
    private Boolean isSubscribed;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime updatedAt;

    public static Builder builder() {
        return new Builder();
    }

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

        public Builder id(Long id) { this.id = id; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder username(String username) { this.username = username; return this; }
        public Builder avatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; return this; }
        public Builder strategyId(Long strategyId) { this.strategyId = strategyId; return this; }
        public Builder strategyName(String strategyName) { this.strategyName = strategyName; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder signalType(String signalType) { this.signalType = signalType; return this; }
        public Builder reason(String reason) { this.reason = reason; return this; }
        public Builder targetPrice(BigDecimal targetPrice) { this.targetPrice = targetPrice; return this; }
        public Builder stopLoss(BigDecimal stopLoss) { this.stopLoss = stopLoss; return this; }
        public Builder timeFrame(String timeFrame) { this.signalTimeFrame = timeFrame; return this; }
        public Builder confidence(Integer confidence) { this.confidence = confidence; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder resultStatus(String resultStatus) { this.resultStatus = resultStatus; return this; }
        public Builder resultProfit(BigDecimal resultProfit) { this.resultProfit = resultProfit; return this; }
        public Builder expiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; return this; }
        public Builder likeCount(Integer likeCount) { this.likeCount = likeCount; return this; }
        public Builder favoriteCount(Integer favoriteCount) { this.favoriteCount = favoriteCount; return this; }
        public Builder subscribeCount(Integer subscribeCount) { this.subscribeCount = subscribeCount; return this; }
        public Builder commentCount(Integer commentCount) { this.commentCount = commentCount; return this; }
        public Builder viewCount(Integer viewCount) { this.viewCount = viewCount; return this; }
        public Builder isFeatured(Boolean isFeatured) { this.isFeatured = isFeatured; return this; }
        public Builder tags(List<String> tags) { this.tags = CollectionCopyUtils.copyList(tags); return this; }
        public Builder isLiked(Boolean isLiked) { this.isLiked = isLiked; return this; }
        public Builder isFavorited(Boolean isFavorited) { this.isFavorited = isFavorited; return this; }
        public Builder isSubscribed(Boolean isSubscribed) { this.isSubscribed = isSubscribed; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

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

    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }
}
