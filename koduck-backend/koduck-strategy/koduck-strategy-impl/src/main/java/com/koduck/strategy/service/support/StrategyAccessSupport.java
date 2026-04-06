package com.koduck.strategy.service.support;

import java.util.Objects;

import org.springframework.stereotype.Component;

import com.koduck.strategy.entity.strategy.Strategy;
import com.koduck.strategy.repository.strategy.StrategyRepository;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * 策略所有权验证和加载的共享支持。
 *
 * @author GitHub Copilot
 */
@Component
public class StrategyAccessSupport {

    /**
     * 用于解析当前用户策略的仓库。
     */
    private final StrategyRepository strategyRepo;

    /**
     * 创建策略访问辅助类。
     *
     * @param strategyRepo 用于策略所有权检查的仓库
     */
    public StrategyAccessSupport(final StrategyRepository strategyRepo) {
        this.strategyRepo = Objects.requireNonNull(strategyRepo, "strategyRepo must not be null");
    }

    /**
     * 加载指定用户拥有的策略，不存在时抛出异常。
     *
     * @param userId     所有者用户ID
     * @param strategyId 目标策略ID
     * @return 拥有的策略实体
     */
    public Strategy loadStrategyOrThrow(final Long userId, final Long strategyId) {
        return requireFound(strategyRepo.findByIdAndUserId(strategyId, userId),
                () -> new IllegalArgumentException("Strategy not found"));
    }
}
