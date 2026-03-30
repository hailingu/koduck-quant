package com.koduck.service.support;

import com.koduck.entity.Strategy;
import com.koduck.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Shared support for strategy ownership validation and loading.
 *
 * @author GitHub Copilot
 * @date 2026-03-30
 */
@Component
@RequiredArgsConstructor
public class StrategyAccessSupport {

    private final StrategyRepository strategyRepository;

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