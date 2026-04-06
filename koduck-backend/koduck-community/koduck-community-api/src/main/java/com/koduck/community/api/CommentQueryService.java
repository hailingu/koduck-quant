package com.koduck.community.api;

import com.koduck.community.dto.CommentDto;
import com.koduck.community.dto.CommentSummaryDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Optional;

/**
 * 评论查询服务接口。
 *
 * <p>提供评论的查询操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface CommentQueryService {

    /**
     * 根据ID获取评论详情。
     *
     * @param commentId 评论ID
     * @return 评论详情，未找到时返回 empty
     */
    Optional<CommentDto> getComment(@NotNull @Positive Long commentId);

    /**
     * 获取信号的所有评论（分页）。
     *
     * @param signalId 信号ID
     * @param page 页码（从1开始）
     * @param pageSize 每页大小
     * @return 评论列表
     */
    List<CommentSummaryDto> getSignalComments(@NotNull @Positive Long signalId,
                                              @Positive int page,
                                              @Positive int pageSize);

    /**
     * 获取评论的所有回复。
     *
     * @param parentId 父评论ID
     * @param page 页码
     * @param pageSize 每页大小
     * @return 回复列表
     */
    List<CommentSummaryDto> getCommentReplies(@NotNull @Positive Long parentId,
                                              @Positive int page,
                                              @Positive int pageSize);

    /**
     * 获取用户的所有评论。
     *
     * @param userId 用户ID
     * @param page 页码
     * @param pageSize 每页大小
     * @return 评论列表
     */
    List<CommentSummaryDto> getUserComments(@NotNull @Positive Long userId,
                                            @Positive int page,
                                            @Positive int pageSize);

    /**
     * 获取信号的顶级评论（不包含回复）。
     *
     * @param signalId 信号ID
     * @param page 页码
     * @param pageSize 每页大小
     * @return 评论列表
     */
    List<CommentSummaryDto> getTopLevelComments(@NotNull @Positive Long signalId,
                                                @Positive int page,
                                                @Positive int pageSize);

    /**
     * 计算信号的评论数量。
     *
     * @param signalId 信号ID
     * @return 评论数量
     */
    long countSignalComments(@NotNull @Positive Long signalId);
}
