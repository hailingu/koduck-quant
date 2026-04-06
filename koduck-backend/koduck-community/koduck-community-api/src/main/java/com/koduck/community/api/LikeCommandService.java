package com.koduck.community.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 点赞命令服务接口。
 *
 * <p>提供点赞的创建和取消操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface LikeCommandService {

    /**
     * 点赞目标。
     *
     * @param userId 用户ID
     * @param targetType 目标类型（SIGNAL/COMMENT）
     * @param targetId 目标ID
     */
    void like(@NotNull @Positive Long userId,
              @NotBlank String targetType,
              @NotNull @Positive Long targetId);

    /**
     * 取消点赞。
     *
     * @param userId 用户ID
     * @param targetType 目标类型
     * @param targetId 目标ID
     */
    void unlike(@NotNull @Positive Long userId,
                @NotBlank String targetType,
                @NotNull @Positive Long targetId);

    /**
     * 切换点赞状态。
     *
     * @param userId 用户ID
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @return 当前是否已点赞
     */
    boolean toggleLike(@NotNull @Positive Long userId,
                       @NotBlank String targetType,
                       @NotNull @Positive Long targetId);
}
