package com.koduck.service.support;
import java.util.Objects;

import org.springframework.stereotype.Component;

import com.koduck.entity.Strategy;
import com.koduck.repository.StrategyRepository;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Shared support for strategy ownership validation and loading.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
public class StrategyAccessSupport {

    /**
     * Repository used to resolve strategies for the current user.
     */
    private final StrategyRepository strategyRepo;

    /**
     * Creates a strategy access helper.
     *
     * @param strategyRepo repository used for strategy ownership checks
     */
    public StrategyAccessSupport(final StrategyRepository strategyRepo) {
        this.strategyRepo = Objects.requireNonNull(strategyRepo, "strategyRepo must not be null");
    }

    /**
     * Loads a strategy owned by the specified user or throws when absent.
     *
     * @param userId owner user id
     * @param strategyId target strategy id
     * @return owned strategy entity
     */
    public Strategy loadStrategyOrThrow(final Long userId, final Long strategyId) {
        return requireFound(strategyRepo.findByIdAndUserId(strategyId, userId),
                () -> new IllegalArgumentException("Strategy not found"));
    }
}