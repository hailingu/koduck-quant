package com.koduck.controller;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.backtest.BacktestResultDto;
import com.koduck.dto.backtest.BacktestTradeDto;
import com.koduck.dto.backtest.RunBacktestRequest;
import com.koduck.security.UserPrincipal;
import com.koduck.service.BacktestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST API controller for backtest operations.
 *
 * <p>All endpoints are secured and operate on the currently authenticated user.
 * Business logic is delegated to {@link com.koduck.service.BacktestService}.
 *
 * @author GitHub Copilot
 */
@RestController
@RequestMapping("/api/v1/backtest")
@Validated
@Slf4j
@Tag(name = "回测管理", description = "策略回测执行与结果查询接口")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
public class BacktestController {

    /**
     * Authenticated user resolver.
     */
    private final AuthenticatedUserResolver authenticatedUserResolver;

    /**
     * Backtest service.
     */
    private final BacktestService backtestService;

    /**
     * Retrieve all backtest results belonging to the authenticated user.
     *
     * @param userPrincipal the currently authenticated principal, injected by
     *                      Spring Security
     * @return a successful {@link com.koduck.dto.ApiResponse} containing a list of
     *         {@link com.koduck.dto.backtest.BacktestResultDto}
     */
    @Operation(
        summary = "获取回测结果列表",
        description = "获取当前用户的所有回测结果"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = BacktestResultDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<List<BacktestResultDto>> getBacktestResults(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/backtest: user={}", userId);
        List<BacktestResultDto> results = backtestService.getBacktestResults(userId);
        return ApiResponse.success(results);
    }

    /**
     * Retrieve a single backtest result by its identifier.
     *
     * @param userPrincipal the authenticated principal
     * @param id            the unique identifier of the backtest result
     * @return the corresponding {@link com.koduck.dto.backtest.BacktestResultDto}
     */
    @Operation(
        summary = "获取回测结果详情",
        description = "获取指定ID的回测结果详细信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = BacktestResultDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该回测结果"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "回测结果不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}")
    public ApiResponse<BacktestResultDto> getBacktestResult(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "回测结果ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/backtest/{}: user={}", id, userId);
        BacktestResultDto result = backtestService.getBacktestResult(userId, id);
        return ApiResponse.success(result);
    }

    /**
     * Execute a new backtest using the supplied request parameters.
     *
     * @param userPrincipal the authenticated principal
     * @param request       validated backtest configuration
     * @return the {@link com.koduck.dto.backtest.BacktestResultDto} generated by
     *         the service
     */
    @Operation(
        summary = "执行回测",
        description = "使用指定参数执行策略回测\n\n" +
                      "注意：回测执行可能需要较长时间，请耐心等待"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "回测执行成功",
            content = @Content(schema = @Schema(implementation = BacktestResultDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误或策略无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "策略不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "回测请求过于频繁"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误或回测执行失败")
    })
    @PostMapping("/run")
    public ApiResponse<BacktestResultDto> runBacktest(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody RunBacktestRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/backtest/run: user={}, strategyId={}, symbol={}",
                 userId, request.strategyId(), request.symbol());
        BacktestResultDto result = backtestService.runBacktest(userId, request);
        return ApiResponse.success(result);
    }

    /**
     * List all trades produced by a given backtest result.
     *
     * @param userPrincipal the authenticated principal
     * @param id            the backtest result identifier
     * @return list of {@link com.koduck.dto.backtest.BacktestTradeDto}
     */
    @Operation(
        summary = "获取回测交易记录",
        description = "获取指定回测结果的所有交易记录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = BacktestTradeDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该回测结果"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "回测结果不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}/trades")
    public ApiResponse<List<BacktestTradeDto>> getBacktestTrades(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "回测结果ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/backtest/{}/trades: user={}", id, userId);
        List<BacktestTradeDto> trades = backtestService.getBacktestTrades(userId, id);
        return ApiResponse.success(trades);
    }

    /**
     * Remove a backtest result owned by the current user.
     *
     * @param userPrincipal the authenticated principal
     * @param id            identifier of the backtest result to delete
     * @return a successful empty {@link com.koduck.dto.ApiResponse}
     */
    @Operation(
        summary = "删除回测结果",
        description = "删除指定ID的回测结果及其交易记录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该回测结果"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "回测结果不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteBacktestResult(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "回测结果ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("DELETE /api/v1/backtest/{}: user={}", id, userId);
        backtestService.deleteBacktestResult(userId, id);
        return ApiResponse.successNoContent();
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
