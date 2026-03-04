package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.strategy.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.StrategyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Strategy (交易策略) REST API controller.
 */
@RestController
@RequestMapping("/api/v1/strategies")
@RequiredArgsConstructor
@Validated
@Slf4j
public class StrategyController {
    
    private final StrategyService strategyService;
    
    /**
     * Get all strategies for the current user.
     */
    @GetMapping
    public ApiResponse<List<StrategyDto>> getStrategies(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/strategies: user={}", userPrincipal.getUser().getId());
        
        List<StrategyDto> strategies = strategyService.getStrategies(userPrincipal.getUser().getId());
        return ApiResponse.success(strategies);
    }
    
    /**
     * Get a strategy by id.
     */
    @GetMapping("/{id}")
    public ApiResponse<StrategyDto> getStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("GET /api/v1/strategies/{}: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.getStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Create a new strategy.
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
     * Update a strategy.
     */
    @PutMapping("/{id}")
    public ApiResponse<StrategyDto> updateStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateStrategyRequest request) {
        
        log.debug("PUT /api/v1/strategies/{}: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.updateStrategy(userPrincipal.getUser().getId(), id, request);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Delete a strategy.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("DELETE /api/v1/strategies/{}: user={}", id, userPrincipal.getUser().getId());
        
        strategyService.deleteStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success();
    }
    
    /**
     * Publish a strategy.
     */
    @PostMapping("/{id}/publish")
    public ApiResponse<StrategyDto> publishStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("POST /api/v1/strategies/{}/publish: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.publishStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Disable a strategy.
     */
    @PostMapping("/{id}/disable")
    public ApiResponse<StrategyDto> disableStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("POST /api/v1/strategies/{}/disable: user={}", id, userPrincipal.getUser().getId());
        
        StrategyDto strategy = strategyService.disableStrategy(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(strategy);
    }
    
    /**
     * Get versions for a strategy.
     */
    @GetMapping("/{id}/versions")
    public ApiResponse<List<StrategyVersionDto>> getVersions(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("GET /api/v1/strategies/{}/versions: user={}", id, userPrincipal.getUser().getId());
        
        List<StrategyVersionDto> versions = strategyService.getVersions(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(versions);
    }
    
    /**
     * Get a specific version.
     */
    @GetMapping("/{id}/versions/{versionNumber}")
    public ApiResponse<StrategyVersionDto> getVersion(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @PathVariable Integer versionNumber) {
        
        log.debug("GET /api/v1/strategies/{}/versions/{}: user={}", id, versionNumber, userPrincipal.getUser().getId());
        
        StrategyVersionDto version = strategyService.getVersion(userPrincipal.getUser().getId(), id, versionNumber);
        return ApiResponse.success(version);
    }
    
    /**
     * Activate a specific version.
     */
    @PostMapping("/{id}/versions/{versionId}/activate")
    public ApiResponse<StrategyVersionDto> activateVersion(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @PathVariable Long versionId) {
        
        log.debug("POST /api/v1/strategies/{}/versions/{}/activate: user={}", id, versionId, userPrincipal.getUser().getId());
        
        StrategyVersionDto version = strategyService.activateVersion(userPrincipal.getUser().getId(), id, versionId);
        return ApiResponse.success(version);
    }
}
