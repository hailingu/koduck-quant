package com.koduck.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.time.Instant;

/**
 * 点赞数据传输对象。
 *
 * @param id 点赞ID
 * @param userId 用户ID
 * @param targetType 目标类型（SIGNAL/COMMENT）
 * @param targetId 目标ID
 * @param createdAt 创建时间
 */
@Value
@Builder
public class LikeDto implements Serializable {
    private static final long serialVersionUID = 1L;

    @Positive
    Long id;

    @NotNull
    @Positive
    Long userId;

    @NotBlank
    String targetType;

    @NotNull
    @Positive
    Long targetId;

    Instant createdAt;

    /**
     * 点赞目标类型常量。
     */
    public static class TargetType {
        public static final String SIGNAL = "SIGNAL";
        public static final String COMMENT = "COMMENT";
    }
}
