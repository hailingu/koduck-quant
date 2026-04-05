package com.koduck.community.api;

import com.koduck.community.dto.LikeDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

/**
 * 点赞查询服务接口。
 *
 * <p>提供点赞的查询操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface LikeQueryService {

    /**
     * 获取目标的所有点赞。
     *
     * @param targetType 目标类型（SIGNAL/COMMENT）
     * @param targetId 目标ID
     * @param page 页码（从1开始）
     * @param pageSize 每页大小
     * @return 点赞列表
     */
    List<LikeDto> getTargetLikes(@NotBlank String targetType,
                                 @NotNull @Positive Long targetId,
                                 @Positive int page,
                                 @Positive int pageSize);

    /**
     * 获取用户的所有点赞。
     *
     * @param userId 用户ID
     * @param page 页码
     * @param pageSize 每页大小
     * @return 点赞列表
     */
    List<LikeDto> getUserLikes(@NotNull @Positive Long userId,
                               @Positive int page,
                               @Positive int pageSize);

    /**
     * 检查用户是否点赞了目标。
     *
     * @param userId 用户ID
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @return 是否已点赞
     */
    boolean hasUserLiked(@NotNull @Positive Long userId,
                         @NotBlank String targetType,
                         @NotNull @Positive Long targetId);

    /**
     * 获取目标的点赞数量。
     *
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @return 点赞数量
     */
    long countTargetLikes(@NotBlank String targetType, @NotNull @Positive Long targetId);
}
