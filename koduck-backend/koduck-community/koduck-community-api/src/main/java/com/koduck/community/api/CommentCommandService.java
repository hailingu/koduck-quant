package com.koduck.community.api;

import com.koduck.community.dto.CommentDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 评论命令服务接口。
 *
 * <p>提供评论的创建、更新、删除操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface CommentCommandService {

    /**
     * 发表评论。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     * @param dto 评论数据
     * @return 创建后的评论
     */
    CommentDto createComment(@NotNull @Positive Long userId,
                             @NotNull @Positive Long signalId,
                             @Valid CommentDto dto);

    /**
     * 发表回复。
     *
     * @param userId 用户ID
     * @param parentId 父评论ID
     * @param dto 回复数据
     * @return 创建后的回复
     */
    CommentDto createReply(@NotNull @Positive Long userId,
                           @NotNull @Positive Long parentId,
                           @Valid CommentDto dto);

    /**
     * 更新评论。
     *
     * @param commentId 评论ID
     * @param dto 更新的评论数据
     * @return 更新后的评论
     */
    CommentDto updateComment(@NotNull @Positive Long commentId, @Valid CommentDto dto);

    /**
     * 删除评论。
     *
     * @param commentId 评论ID
     */
    void deleteComment(@NotNull @Positive Long commentId);
}
