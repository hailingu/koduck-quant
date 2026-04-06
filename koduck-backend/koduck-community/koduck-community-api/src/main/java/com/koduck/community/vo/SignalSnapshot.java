package com.koduck.community.vo;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 信号快照值对象。
 *
 * <p>供其他领域模块（如 AI、Portfolio）使用，包含信号的核心信息。</p>
 *
 * @param signalId 信号ID
 * @param userId 用户ID
 * @param username 用户名
 * @param portfolioId 投资组合ID
 * @param title 信号标题
 * @param direction 交易方向
 * @param symbol 股票代码
 * @param market 市场
 * @param entryPrice 入场价格
 * @param status 信号状态
 * @param viewCount 浏览次数
 * @param likeCount 点赞数
 * @param commentCount 评论数
 * @param createdAt 创建时间
 */
public record SignalSnapshot(
        Long signalId,
        Long userId,
        String username,
        Long portfolioId,
        String title,
        String direction,
        String symbol,
        String market,
        BigDecimal entryPrice,
        String status,
        Integer viewCount,
        Integer likeCount,
        Integer commentCount,
        Instant createdAt
) implements Serializable {

    private static final long serialVersionUID = 1L;

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
    }
}
