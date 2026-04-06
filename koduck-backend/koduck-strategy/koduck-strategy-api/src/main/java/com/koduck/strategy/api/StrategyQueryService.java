package com.koduck.strategy.api;

import com.koduck.strategy.dto.StrategyDto;
import com.koduck.strategy.dto.StrategySummaryDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Optional;

/**
 * 策略查询服务接口。
 *
 * <p>提供策略的查询操作，不包含修改操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface StrategyQueryService {

    /**
     * 根据ID获取策略详情。
     *
     * @param strategyId 策略ID
     * @return 策略详情，未找到时返回 empty
     */
    Optional<StrategyDto> getStrategy(@NotNull @Positive Long strategyId);

    /**
     * 获取用户的所有策略。
     *
     * @param userId 用户ID
     * @return 策略列表
     */
    List<StrategySummaryDto> getUserStrategies(@NotNull @Positive Long userId);

    /**
     * 获取用户的策略数量。
     *
     * @param userId 用户ID
     * @return 策略数量
     */
    long countUserStrategies(@NotNull @Positive Long userId);

    /**
     * 检查策略是否存在。
     *
     * @param strategyId 策略ID
     * @return 是否存在
     */
    boolean exists(@NotNull @Positive Long strategyId);

    /**
     * 检查策略是否属于指定用户。
     *
     * @param strategyId 策略ID
     * @param userId 用户ID
     * @return 是否属于该用户
     */
    boolean belongsToUser(@NotNull @Positive Long strategyId, @NotNull @Positive Long userId);
}
