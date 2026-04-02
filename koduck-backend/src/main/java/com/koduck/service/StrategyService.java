package com.koduck.service;

import java.util.List;

import com.koduck.dto.strategy.CreateStrategyRequest;
import com.koduck.dto.strategy.StrategyDto;
import com.koduck.dto.strategy.StrategyVersionDto;
import com.koduck.dto.strategy.UpdateStrategyRequest;

/**
 * Service interface for strategy operations.
 *
 * @author Koduck Team
 */
public interface StrategyService {

    /**
     * Get all strategies for a user.
     *
     * @param userId the user ID
     * @return the list of strategies
     */
    List<StrategyDto> getStrategies(Long userId);

    /**
     * Get a strategy by id.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     * @return the strategy
     */
    StrategyDto getStrategy(Long userId, Long strategyId);

    /**
     * Create a new strategy.
     *
     * @param userId  the user ID
     * @param request the create request
     * @return the created strategy
     */
    StrategyDto createStrategy(Long userId, CreateStrategyRequest request);

    /**
     * Update a strategy.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     * @param request    the update request
     * @return the updated strategy
     */
    StrategyDto updateStrategy(Long userId, Long strategyId, UpdateStrategyRequest request);

    /**
     * Delete a strategy.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     */
    void deleteStrategy(Long userId, Long strategyId);

    /**
     * Publish a strategy.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     * @return the published strategy
     */
    StrategyDto publishStrategy(Long userId, Long strategyId);

    /**
     * Disable a strategy.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     * @return the disabled strategy
     */
    StrategyDto disableStrategy(Long userId, Long strategyId);

    /**
     * Get versions for a strategy.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     * @return the list of strategy versions
     */
    List<StrategyVersionDto> getVersions(Long userId, Long strategyId);

    /**
     * Get a specific version.
     *
     * @param userId        the user ID
     * @param strategyId    the strategy ID
     * @param versionNumber the version number
     * @return the strategy version
     */
    StrategyVersionDto getVersion(Long userId, Long strategyId, Integer versionNumber);

    /**
     * Activate a specific version.
     *
     * @param userId     the user ID
     * @param strategyId the strategy ID
     * @param versionId  the version ID
     * @return the activated strategy version
     */
    StrategyVersionDto activateVersion(Long userId, Long strategyId, Long versionId);
}
