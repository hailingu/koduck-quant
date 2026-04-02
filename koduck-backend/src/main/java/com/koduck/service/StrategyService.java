package com.koduck.service;
import java.util.List;

import com.koduck.dto.strategy.*;

/**
 * Service interface for strategy operations.
 */
public interface StrategyService {
    
    /**
     * Get all strategies for a user.
     */
    List<StrategyDto> getStrategies(Long userId);
    
    /**
     * Get a strategy by id.
     */
    StrategyDto getStrategy(Long userId, Long strategyId);
    
    /**
     * Create a new strategy.
     */
    StrategyDto createStrategy(Long userId, CreateStrategyRequest request);
    
    /**
     * Update a strategy.
     */
    StrategyDto updateStrategy(Long userId, Long strategyId, UpdateStrategyRequest request);
    
    /**
     * Delete a strategy.
     */
    void deleteStrategy(Long userId, Long strategyId);
    
    /**
     * Publish a strategy.
     */
    StrategyDto publishStrategy(Long userId, Long strategyId);
    
    /**
     * Disable a strategy.
     */
    StrategyDto disableStrategy(Long userId, Long strategyId);
    
    /**
     * Get versions for a strategy.
     */
    List<StrategyVersionDto> getVersions(Long userId, Long strategyId);
    
    /**
     * Get a specific version.
     */
    StrategyVersionDto getVersion(Long userId, Long strategyId, Integer versionNumber);
    
    /**
     * Activate a specific version.
     */
    StrategyVersionDto activateVersion(Long userId, Long strategyId, Long versionId);
}
