package com.koduck.service.support;

import com.koduck.entity.Strategy;
import com.koduck.repository.StrategyRepository;
import java.util.Objects;
import org.springframework.stereotype.Component;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Shared support for strategy ownership validation and loading.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
public class StrategyAccessSupport {

    private final StrategyRepository strategyRepository;

    public StrategyAccessSupport(StrategyRepository strategyRepository) {
        this.strategyRepository = Objects.requireNonNull(strategyRepository,
                "strategyRepository must not be null");
    }

    /**
     * Loads a strategy owned by the specified user or throws when absent.
     *
     * @param userId owner user id
     * @param strategyId target strategy id
     * @return owned strategy entity
     */
    public Strategy loadStrategyOrThrow(Long userId, Long strategyId) {
        return requireFound(strategyRepository.findByIdAndUserId(strategyId, userId),
                () -> new IllegalArgumentException("Strategy not found"));
    }
}