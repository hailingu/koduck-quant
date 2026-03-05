package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.strategy.CreateStrategyRequest;
import com.koduck.dto.strategy.StrategyDto;
import com.koduck.dto.strategy.StrategyVersionDto;
import com.koduck.dto.strategy.UpdateStrategyRequest;
import com.koduck.security.UserPrincipal;
import com.koduck.service.StrategyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API controller for trading strategies.
 * <p>
 * Provides endpoints to manage user-defined strategies, including versioning
 * and publication controls.
 */
@RestController
@RequestMapping("/api/v1/strategies")
@RequiredArgsConstructor
@Validated
@Tag(name = "Strategies", description = "Trading strategy management APIs")
@Slf4j
public class StrategyController {
    
    private final StrategyService strategyService;
    
    /**
     * Retrieve all strategies owned by the authenticated user.
     *
     * @param userPrincipal the authenticated user's principal
     * @return list of strategy DTOs
     */
    @GetMapping
    public ApiResponse<List<StrategyDto>> getStrategies(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/strategies: user={}", userPrincipal.getUser().getId());
        
        List<StrategyDto> strategies = strategyService.getStrategies(userPrincipal.getUser().getId());
        return ApiResponse.success(strategies);
    }
    
    /**
     * Retrieve a specific strategy by its identifier.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the strategy id to fetch
     * @return the requested strategy DTO
     */
    @GetMapping("/{id}")
    public ApiResponse<StrategyDto> getStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        
        log.debug("GET /api/v1/strategies/{}: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.getStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Create a new strategy for the current user.
     *
     * @param userPrincipal the authenticated user's principal
     * @param request creation parameters (validated)
     * @return the created strategy DTO
     */
    @PostMapping
    public ApiResponse<StrategyDto> createStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateStrategyRequest request) {
        
        log.debug("POST /api/v1/strategies: user={}, name={}", userPrincipal.getUser().getId(), request.name());
        
        StrategyDto strategy = strategyService.createStrategy(userPrincipal.getUser().getId(), request);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Update an existing strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to update
     * @param request update parameters (validated)
     * @return updated strategy DTO
     */
    @PutMapping("/{id}")
    public ApiResponse<StrategyDto> updateStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id,
            @Valid @RequestBody UpdateStrategyRequest request) {
        
        log.debug("PUT /api/v1/strategies/{}: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.updateStrategy(userPrincipal.getUser().getId(), id, request);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Delete a strategy by its identifier.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to delete
     * @return empty response
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        
        log.debug("DELETE /api/v1/strategies/{}: user={}", id, userPrincipal.getUser().getId());
        
        strategyService.deleteStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success();
    }
    
    /**
     * Publish (make active) a strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to publish
     * @return the published strategy DTO
     */
    @PostMapping("/{id}/publish")
    public ApiResponse<StrategyDto> publishStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        
        log.debug("POST /api/v1/strategies/{}/publish: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.publishStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Disable a previously published strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to disable
     * @return the disabled strategy DTO
     */
    @PostMapping("/{id}/disable")
    public ApiResponse<StrategyDto> disableStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        
        log.debug("POST /api/v1/strategies/{}/disable: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.disableStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(strategy);
    }
    
    /**
     * List all versions belonging to a strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the strategy id whose versions are requested
     * @return list of version DTOs
     */
    @GetMapping("/{id}/versions")
    public ApiResponse<List<StrategyVersionDto>> getVersions(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        
        log.debug("GET /api/v1/strategies/{}/versions: user={}", id, userPrincipal.getUser().getId());
        
        List<StrategyVersionDto> versions = strategyService.getVersions(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(versions);
    }
    
    /**
     * Retrieve a particular version of a strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the strategy id
     * @param versionNumber the version number to fetch
     * @return the version DTO
     */
    @GetMapping("/{id}/versions/{versionNumber}")
    public ApiResponse<StrategyVersionDto> getVersion(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id,
            @PathVariable @Positive(message = "Version number must be positive") Integer versionNumber) {
        
        log.debug("GET /api/v1/strategies/{}/versions/{}: user={}", id, versionNumber, userPrincipal.getUser().getId());
        
        StrategyVersionDto version = strategyService.getVersion(userPrincipal.getUser().getId(), id, versionNumber);
        return ApiResponse.success(version);
    }
    
    /**
     * Activate a given version of the strategy (set it as current).
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the strategy id
     * @param versionId the identifier of the version to activate
     * @return the activated version DTO
     */
    @PostMapping("/{id}/versions/{versionId}/activate")
    public ApiResponse<StrategyVersionDto> activateVersion(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id,
            @PathVariable @Positive(message = "Version ID must be positive") Long versionId) {
        
        log.debug("POST /api/v1/strategies/{}/versions/{}/activate: user={}", id, versionId, userPrincipal.getUser().getId());
        
        StrategyVersionDto version = strategyService.activateVersion(userPrincipal.getUser().getId(), id, versionId);
        return ApiResponse.success(version);
    }
}
