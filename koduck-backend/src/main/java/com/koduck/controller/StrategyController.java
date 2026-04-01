package com.koduck.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.strategy.CreateStrategyRequest;
import com.koduck.dto.strategy.StrategyDto;
import com.koduck.dto.strategy.StrategyVersionDto;
import com.koduck.dto.strategy.UpdateStrategyRequest;
import com.koduck.security.UserPrincipal;
import com.koduck.service.StrategyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API controller for trading strategies.
 * <p>
 * Provides endpoints to manage user-defined strategies, including versioning
 * and publication controls.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/strategies")
@Validated
@Tag(name = "策略管理", description = "交易策略管理接口，包括策略版本控制")
@SecurityRequirement(name = "bearerAuth")
@Slf4j
@RequiredArgsConstructor
public class StrategyController {

    private final AuthenticatedUserResolver authenticatedUserResolver;
    private final StrategyService strategyService;

    /**
     * Retrieve all strategies owned by the authenticated user.
     *
     * @param userPrincipal the authenticated user's principal
     * @return list of strategy DTOs
     */
    @Operation(
        summary = "获取策略列表",
        description = "获取当前用户创建的所有策略"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = StrategyDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<List<StrategyDto>> getStrategies(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/strategies: user={}", userId);
        List<StrategyDto> strategies = strategyService.getStrategies(userId);
        return ApiResponse.success(strategies);
    }

    /**
     * Retrieve a specific strategy by its identifier.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the strategy id to fetch
     * @return the requested strategy DTO
     */
    @Operation(
        summary = "获取策略详情",
        description = "获取指定ID的策略详细信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = StrategyDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}")
    public ApiResponse<StrategyDto> getStrategy(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/strategies/{}: user={}", id, userId);
        StrategyDto strategy = strategyService.getStrategy(userId, id);
        return ApiResponse.success(strategy);
    }

    /**
     * Create a new strategy for the current user.
     *
     * @param userPrincipal the authenticated user's principal
     * @param request creation parameters (validated)
     * @return the created strategy DTO
     */
    @Operation(
        summary = "创建策略",
        description = "创建新的交易策略"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "创建成功",
            content = @Content(schema = @Schema(implementation = StrategyDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping
    public ApiResponse<StrategyDto> createStrategy(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateStrategyRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/strategies: user={}, name={}", userId, request.name());
        StrategyDto strategy = strategyService.createStrategy(userId, request);
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
    @Operation(
        summary = "更新策略",
        description = "更新指定ID的策略信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = StrategyDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权更新该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/{id}")
    public ApiResponse<StrategyDto> updateStrategy(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id,
            @Valid @RequestBody UpdateStrategyRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("PUT /api/v1/strategies/{}: user={}", id, userId);
        StrategyDto strategy = strategyService.updateStrategy(userId, id, request);
        return ApiResponse.success(strategy);
    }

    /**
     * Delete a strategy by its identifier.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to delete
     * @return empty response
     */
    @Operation(
        summary = "删除策略",
        description = "删除指定ID的策略"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteStrategy(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("DELETE /api/v1/strategies/{}: user={}", id, userId);
        strategyService.deleteStrategy(userId, id);
        return ApiResponse.successNoContent();
    }

    /**
     * Publish (make active) a strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to publish
     * @return the published strategy DTO
     */
    @Operation(
        summary = "发布策略",
        description = "发布策略，使其处于激活状态"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "发布成功",
            content = @Content(schema = @Schema(implementation = StrategyDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "策略状态不允许发布"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权发布该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/{id}/publish")
    public ApiResponse<StrategyDto> publishStrategy(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/strategies/{}/publish: user={}", id, userId);
        StrategyDto strategy = strategyService.publishStrategy(userId, id);
        return ApiResponse.success(strategy);
    }

    /**
     * Disable a previously published strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the id of the strategy to disable
     * @return the disabled strategy DTO
     */
    @Operation(
        summary = "停用策略",
        description = "停用已发布的策略"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "停用成功",
            content = @Content(schema = @Schema(implementation = StrategyDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "策略状态不允许停用"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权停用该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/{id}/disable")
    public ApiResponse<StrategyDto> disableStrategy(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/strategies/{}/disable: user={}", id, userId);
        StrategyDto strategy = strategyService.disableStrategy(userId, id);
        return ApiResponse.success(strategy);
    }

    /**
     * List all versions belonging to a strategy.
     *
     * @param userPrincipal the authenticated user's principal
     * @param id the strategy id whose versions are requested
     * @return list of version DTOs
     */
    @Operation(
        summary = "获取策略版本列表",
        description = "获取指定策略的所有版本历史"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = StrategyVersionDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}/versions")
    public ApiResponse<List<StrategyVersionDto>> getVersions(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/strategies/{}/versions: user={}", id, userId);
        List<StrategyVersionDto> versions = strategyService.getVersions(userId, id);
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
    @Operation(
        summary = "获取策略版本详情",
        description = "获取指定策略的指定版本详情"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = StrategyVersionDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略或版本不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}/versions/{versionNumber}")
    public ApiResponse<StrategyVersionDto> getVersion(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id,
            @Parameter(description = "版本号", example = "1")
            @PathVariable @Positive(message = "Version number must be positive") Integer versionNumber) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/strategies/{}/versions/{}: user={}", id, versionNumber, userId);
        StrategyVersionDto version = strategyService.getVersion(userId, id, versionNumber);
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
    @Operation(
        summary = "激活策略版本",
        description = "将指定版本设为当前生效版本"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "激活成功",
            content = @Content(schema = @Schema(implementation = StrategyVersionDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "版本状态不允许激活"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权操作该策略"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略或版本不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/{id}/versions/{versionId}/activate")
    public ApiResponse<StrategyVersionDto> activateVersion(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "策略ID", example = "1")
            @PathVariable @Positive(message = "Strategy ID must be positive") Long id,
            @Parameter(description = "版本ID", example = "1")
            @PathVariable @Positive(message = "Version ID must be positive") Long versionId) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/strategies/{}/versions/{}/activate: user={}", id, versionId, userId);
        StrategyVersionDto version = strategyService.activateVersion(userId, id, versionId);
        return ApiResponse.success(version);
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
