package com.koduck.strategy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.time.Instant;

/**
 * 策略数据传输对象。
 *
 * @param id 策略ID
 * @param userId 用户ID
 * @param name 策略名称
 * @param description 策略描述
 * @param type 策略类型
 * @param params 策略参数（JSON格式）
 * @param code 策略代码
 * @param status 策略状态
 * @param createdAt 创建时间
 * @param updatedAt 更新时间
 */
@Value
@Builder
public class StrategyDto implements Serializable {
    private static final long serialVersionUID = 1L;

    @Positive
    Long id;

    @NotNull
    @Positive
    Long userId;

    @NotBlank
    String name;

    String description;

    @NotBlank
    String type;

    String params;

    String code;

    @NotBlank
    String status;

    Instant createdAt;

    Instant updatedAt;
}
