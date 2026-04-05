package com.koduck.community.dto;

import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 信号详情数据传输对象。
 */
@EqualsAndHashCode
@ToString
public class SignalDetailDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private final Long id;
    private final Long userId;
    private final String username;
    private final String userAvatar;
    private final Long portfolioId;
    private final String portfolioName;
    private final String title;
    private final String content;
    private final String direction;
    private final String symbol;
    private final String market;
    private final BigDecimal entryPrice;
    private final BigDecimal stopLoss;
    private final BigDecimal takeProfit;
    private final String status;
    private final Integer viewCount;
    private final Integer likeCount;
    private final Integer commentCount;
    private final List<CommentDto> comments;
    private final Instant createdAt;
    private final Instant updatedAt;

    private SignalDetailDto(Builder builder) {
        this.id = builder.id;
        this.userId = builder.userId;
        this.username = builder.username;
        this.userAvatar = builder.userAvatar;
        this.portfolioId = builder.portfolioId;
        this.portfolioName = builder.portfolioName;
        this.title = builder.title;
        this.content = builder.content;
        this.direction = builder.direction;
        this.symbol = builder.symbol;
        this.market = builder.market;
        this.entryPrice = builder.entryPrice;
        this.stopLoss = builder.stopLoss;
        this.takeProfit = builder.takeProfit;
        this.status = builder.status;
        this.viewCount = builder.viewCount;
        this.likeCount = builder.likeCount;
        this.commentCount = builder.commentCount;
        this.comments = builder.comments == null ? null : new ArrayList<>(builder.comments);
        this.createdAt = builder.createdAt;
        this.updatedAt = builder.updatedAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    // Getters
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getUserAvatar() { return userAvatar; }
    public Long getPortfolioId() { return portfolioId; }
    public String getPortfolioName() { return portfolioName; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getDirection() { return direction; }
    public String getSymbol() { return symbol; }
    public String getMarket() { return market; }
    public BigDecimal getEntryPrice() { return entryPrice; }
    public BigDecimal getStopLoss() { return stopLoss; }
    public BigDecimal getTakeProfit() { return takeProfit; }
    public String getStatus() { return status; }
    public Integer getViewCount() { return viewCount; }
    public Integer getLikeCount() { return likeCount; }
    public Integer getCommentCount() { return commentCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    /**
     * 获取评论列表的不可修改视图。
     *
     * @return 评论列表
     */
    public List<CommentDto> getComments() {
        return comments == null ? Collections.emptyList() : List.copyOf(comments);
    }

    public static class Builder {
        private Long id;
        private Long userId;
        private String username;
        private String userAvatar;
        private Long portfolioId;
        private String portfolioName;
        private String title;
        private String content;
        private String direction;
        private String symbol;
        private String market;
        private BigDecimal entryPrice;
        private BigDecimal stopLoss;
        private BigDecimal takeProfit;
        private String status;
        private Integer viewCount;
        private Integer likeCount;
        private Integer commentCount;
        private List<CommentDto> comments;
        private Instant createdAt;
        private Instant updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder username(String username) { this.username = username; return this; }
        public Builder userAvatar(String userAvatar) { this.userAvatar = userAvatar; return this; }
        public Builder portfolioId(Long portfolioId) { this.portfolioId = portfolioId; return this; }
        public Builder portfolioName(String portfolioName) { this.portfolioName = portfolioName; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Builder direction(String direction) { this.direction = direction; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder market(String market) { this.market = market; return this; }
        public Builder entryPrice(BigDecimal entryPrice) { this.entryPrice = entryPrice; return this; }
        public Builder stopLoss(BigDecimal stopLoss) { this.stopLoss = stopLoss; return this; }
        public Builder takeProfit(BigDecimal takeProfit) { this.takeProfit = takeProfit; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder viewCount(Integer viewCount) { this.viewCount = viewCount; return this; }
        public Builder likeCount(Integer likeCount) { this.likeCount = likeCount; return this; }
        public Builder commentCount(Integer commentCount) { this.commentCount = commentCount; return this; }

        public Builder comments(List<CommentDto> comments) {
            this.comments = comments == null ? null : new ArrayList<>(comments);
            return this;
        }

        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(Instant updatedAt) { this.updatedAt = updatedAt; return this; }

        public SignalDetailDto build() {
            return new SignalDetailDto(this);
        }
    }
}
