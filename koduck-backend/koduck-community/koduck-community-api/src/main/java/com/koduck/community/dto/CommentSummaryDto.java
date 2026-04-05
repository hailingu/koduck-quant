package com.koduck.community.dto;

import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.time.Instant;

/**
 * 评论摘要信息。
 *
 * <p>用于列表展示。</p>
 *
 * @param id 评论ID
 * @param signalId 信号ID
 * @param userId 用户ID
 * @param username 用户名
 * @param content 评论内容（截断）
 * @param likeCount 点赞数
 * @param replyCount 回复数
 * @param createdAt 创建时间
 */
@Value
@Builder
public class CommentSummaryDto implements Serializable {
    private static final long serialVersionUID = 1L;

    Long id;
    Long signalId;
    Long userId;
    String username;
    String content;
    Integer likeCount;
    Integer replyCount;
    Instant createdAt;
}
