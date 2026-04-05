package com.koduck.community.dto;

import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 信号摘要信息。
 *
 * <p>用于列表展示，不包含完整的信号内容。</p>
 *
 * @param id 信号ID
 * @param userId 用户ID
 * @param username 用户名
 * @param title 信号标题
 * @param direction 交易方向
 * @param symbol 股票代码
 * @param entryPrice 入场价格
 * @param status 信号状态
 * @param likeCount 点赞数
 * @param commentCount 评论数
 * @param createdAt 创建时间
 */
@Value
@Builder
public class SignalSummaryDto implements Serializable {
    private static final long serialVersionUID = 1L;

    Long id;
    Long userId;
    String username;
    String title;
    String direction;
    String symbol;
    BigDecimal entryPrice;
    String status;
    Integer likeCount;
    Integer commentCount;
    Instant createdAt;
}
