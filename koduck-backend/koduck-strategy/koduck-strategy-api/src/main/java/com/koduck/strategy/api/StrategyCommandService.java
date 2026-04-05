package com.koduck.strategy.api;

import com.koduck.strategy.dto.StrategyDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 策略命令服务接口。
 *
 * <p>提供策略的创建、更新、删除操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface StrategyCommandService {

    /**
     * 创建策略。
     *
     * @param userId 用户ID
     * @param dto 策略数据
     * @return 创建后的策略
     */
    StrategyDto createStrategy(@NotNull @Positive Long userId, @Valid StrategyDto dto);

    /**
     * 更新策略。
     *
     * @param strategyId 策略ID
     * @param dto 更新的策略数据
     * @return 更新后的策略
     */
    StrategyDto updateStrategy(@NotNull @Positive Long strategyId, @Valid StrategyDto dto);

    /**
     * 删除策略。
     *
     * @param strategyId 策略ID
     */
    void deleteStrategy(@NotNull @Positive Long strategyId);

    /**
     * 激活策略。
     *
     * @param strategyId 策略ID
     */
    void activateStrategy(@NotNull @Positive Long strategyId);

    /**
     * 停用策略。
     *
     * @param strategyId 策略ID
     */
    void deactivateStrategy(@NotNull @Positive Long strategyId);
}
