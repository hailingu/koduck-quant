package com.koduck.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 信号数据传输对象。
 *
 * @param id 信号ID
 * @param userId 用户ID
 * @param portfolioId 投资组合ID
 * @param title 信号标题
 * @param content 信号内容
 * @param direction 交易方向（BUY/SELL）
 * @param symbol 股票代码
 * @param market 市场
 * @param entryPrice 入场价格
 * @param stopLoss 止损价格
 * @param takeProfit 止盈价格
 * @param status 信号状态
 * @param viewCount 浏览次数
 * @param likeCount 点赞数
 * @param commentCount 评论数
 * @param createdAt 创建时间
 * @param updatedAt 更新时间
 */
@Value
@Builder
public class SignalDto implements Serializable {
    private static final long serialVersionUID = 1L;

    @Positive
    Long id;

    @NotNull
    @Positive
    Long userId;

    @Positive
    Long portfolioId;

    @NotBlank
    String title;

    String content;

    @NotBlank
    String direction;

    @NotBlank
    String symbol;

    @NotBlank
    String market;

    BigDecimal entryPrice;
    BigDecimal stopLoss;
    BigDecimal takeProfit;

    @NotBlank
    String status;

    Integer viewCount;
    Integer likeCount;
    Integer commentCount;

    Instant createdAt;
    Instant updatedAt;

    /**
     * 信号方向常量。
     */
    public static class Direction {
        public static final String BUY = "BUY";
        public static final String SELL = "SELL";
    }

    /**
     * 信号状态常量。
     */
    public static class Status {
        public static final String ACTIVE = "ACTIVE";
        public static final String CLOSED = "CLOSED";
        public static final String EXPIRED = "EXPIRED";
        public static final String CANCELLED = "CANCELLED";
    }
}
