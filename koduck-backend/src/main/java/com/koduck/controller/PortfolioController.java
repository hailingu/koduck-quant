package com.koduck.controller;
import java.util.List;

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

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;
import com.koduck.security.UserPrincipal;
import com.koduck.service.PortfolioService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST API controller for user portfolios.
 * <p>Provides endpoints to manage positions, trades and summary statistics.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/portfolio")
@Tag(name = "投资组合", description = "持仓管理、交易记录、盈亏统计等投资组合接口")
@SecurityRequirement(name = "bearerAuth")
@Validated
@Slf4j
@RequiredArgsConstructor
public class PortfolioController {

    private final AuthenticatedUserResolver authenticatedUserResolver;
    private final PortfolioService portfolioService;

    /**
     * Retrieve all portfolio positions belonging to the authenticated user.
     *
     * @param userPrincipal authenticated user principal injected by Spring Security
     * @return list of {@link PortfolioPositionDto} objects representing current holdings
     */
    @Operation(
        summary = "获取持仓列表",
        description = "获取当前用户的所有持仓记录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = PortfolioPositionDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<List<PortfolioPositionDto>> getPositions(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/portfolio: user={}", userId);
        List<PortfolioPositionDto> positions = portfolioService.getPositions(userId);
        return ApiResponse.success(positions);
    }

    /**
     * Retrieve a summary of the authenticated user's portfolio.
     *
     * @param userPrincipal authenticated user principal
     * @return {@link PortfolioSummaryDto} containing aggregated costs, market values and PnL
     */
    @Operation(
        summary = "获取投资组合概览",
        description = "获取当前用户的投资组合汇总信息，包括总成本、市值、盈亏等"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = PortfolioSummaryDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/summary")
    public ApiResponse<PortfolioSummaryDto> getPortfolioSummary(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/portfolio/summary: user={}", userId);
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);
        return ApiResponse.success(summary);
    }

    /**
     * Create a new position or update an existing one in the user's portfolio.
     *
     * @param userPrincipal authenticated user principal
     * @param request payload describing the position to add ({@link AddPositionRequest})
     * @return the created or updated {@link PortfolioPositionDto}
     */
    @Operation(
        summary = "添加持仓",
        description = "添加新的持仓记录，如果同市场同代码持仓已存在则更新"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "添加成功",
            content = @Content(schema = @Schema(implementation = PortfolioPositionDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "股票不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping
    public ApiResponse<PortfolioPositionDto> addPosition(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddPositionRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/portfolio: user={}, market={}, symbol={}",
                 userId, request.market(), request.symbol());
        PortfolioPositionDto position = portfolioService.addPosition(userId, request);
        return ApiResponse.success(position);
    }

    /**
     * Modify an existing portfolio position.
     *
     * @param userPrincipal authenticated user principal
     * @param id identifier of the position to update
     * @param request fields to change ({@link UpdatePositionRequest})
     * @return updated {@link PortfolioPositionDto}
     */
    @Operation(
        summary = "更新持仓",
        description = "更新指定ID的持仓记录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = PortfolioPositionDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权更新该持仓"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "持仓记录不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/{id}")
    public ApiResponse<PortfolioPositionDto> updatePosition(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "持仓ID", example = "1")
            @PathVariable @Positive(message = "Position ID must be positive") Long id,
            @Valid @RequestBody UpdatePositionRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("PUT /api/v1/portfolio/{}: user={}", id, userId);
        PortfolioPositionDto position = portfolioService.updatePosition(userId, id, request);
        return ApiResponse.success(position);
    }

    /**
     * Remove a position from the user's portfolio.
     *
     * @param userPrincipal authenticated user principal
     * @param id identifier of the position to delete
     * @return empty success response
     */
    @Operation(
        summary = "删除持仓",
        description = "删除指定ID的持仓记录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该持仓"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "持仓记录不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deletePosition(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "持仓ID", example = "1")
            @PathVariable @Positive(message = "Position ID must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("DELETE /api/v1/portfolio/{}: user={}", id, userId);
        portfolioService.deletePosition(userId, id);
        return ApiResponse.successNoContent();
    }

    /**
     * List trade records associated with the authenticated user.
     *
     * @param userPrincipal authenticated user principal
     * @return list of {@link TradeDto} entries sorted by trade time descending
     */
    @Operation(
        summary = "获取交易记录",
        description = "获取当前用户的所有交易记录，按交易时间倒序排列"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = TradeDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/trades")
    public ApiResponse<List<TradeDto>> getTrades(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/portfolio/trades: user={}", userId);
        List<TradeDto> trades = portfolioService.getTrades(userId);
        return ApiResponse.success(trades);
    }

    /**
     * Create a new trade record and update the corresponding position.
     *
     * @param userPrincipal authenticated user principal
     * @param request trade details ({@link AddTradeRequest})
     * @return the created {@link TradeDto}
     */
    @Operation(
        summary = "添加交易记录",
        description = "添加新的交易记录，并自动更新对应的持仓"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "添加成功",
            content = @Content(schema = @Schema(implementation = TradeDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/trades")
    public ApiResponse<TradeDto> addTrade(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddTradeRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/portfolio/trades: user={}, market={}, symbol={}, type={}",
                 userId, request.market(), request.symbol(), request.tradeType());
        TradeDto trade = portfolioService.addTrade(userId, request);
        return ApiResponse.success(trade);
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
