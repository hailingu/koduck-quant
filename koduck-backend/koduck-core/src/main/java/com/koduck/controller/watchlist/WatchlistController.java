package com.koduck.controller.watchlist;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

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
import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;
import com.koduck.security.AuthUserPrincipal;
import com.koduck.service.WatchlistService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST API controller for watchlist management.
 *
 * @author GitHub Copilot
 */
@RestController
@RequestMapping("/api/v1/watchlist")
@Validated
@Tag(name = "自选股", description = "自选股列表管理接口")
@SecurityRequirement(name = "bearerAuth")
@Slf4j
@RequiredArgsConstructor
public class WatchlistController {

    /**
     * Authenticated user resolver.
     */
    private final AuthenticatedUserResolver authenticatedUserResolver;

    /**
     * Watchlist service.
     */
    private final WatchlistService watchlistService;

    /**
     * Get user's watchlist with real-time prices.
     *
     * @param userPrincipal authenticated user principal
     * @return list of watchlist items
     */
    @Operation(
        summary = "获取自选股列表",
        description = "获取当前用户的自选股列表，包含实时价格信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = WatchlistItemDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<List<WatchlistItemDto>> getWatchlist(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/watchlist: user={}", userId);
        List<WatchlistItemDto> watchlist = watchlistService.getWatchlist(userId);
        return ApiResponse.success(watchlist);
    }

    /**
     * Add a stock to watchlist.
     *
     * @param userPrincipal authenticated user principal
     * @param request add watchlist request
     * @return created watchlist item
     */
    @Operation(
        summary = "添加自选股",
        description = "添加一只股票到当前用户的自选股列表"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "添加成功",
            content = @Content(schema = @Schema(implementation = WatchlistItemDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误或股票已在列表中"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "股票不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping
    public ApiResponse<WatchlistItemDto> addToWatchlist(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @Valid @RequestBody AddWatchlistRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("POST /api/v1/watchlist: user={}, market={}, symbol={}",
                userId, request.market(), request.symbol());
        WatchlistItemDto item = watchlistService.addToWatchlist(userId, request);
        return ApiResponse.success(item);
    }

    /**
     * Remove a stock from watchlist.
     *
     * @param userPrincipal authenticated user principal
     * @param id watchlist item ID
     * @return empty success response
     */
    @Operation(
        summary = "删除自选股",
        description = "从自选股列表中删除指定ID的股票"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该自选股"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "自选股不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/{id}")
    public ApiResponse<Void> removeFromWatchlist(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @Parameter(description = "自选股ID", example = "1")
            @PathVariable @Positive Long id) {
        Long userId = requireUserId(userPrincipal);
        log.debug("DELETE /api/v1/watchlist/{}: user={}", id, userId);
        watchlistService.removeFromWatchlist(userId, id);
        return ApiResponse.successNoContent();
    }

    /**
     * Update sort order of watchlist items.
     *
     * @param userPrincipal authenticated user principal
     * @param request sort request
     * @return empty success response
     */
    @Operation(
        summary = "排序自选股",
        description = "更新自选股列表的排序"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "排序成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/sort")
    public ApiResponse<Void> sortWatchlist(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @Valid @RequestBody SortWatchlistRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("PUT /api/v1/watchlist/sort: user={}, items={}", userId, request.items().size());
        watchlistService.sortWatchlist(userId, request);
        return ApiResponse.successNoContent();
    }

    /**
     * Update notes for a watchlist item.
     *
     * @param userPrincipal authenticated user principal
     * @param id watchlist item ID
     * @param notes notes content
     * @return updated watchlist item
     */
    @Operation(
        summary = "更新自选股备注",
        description = "更新指定自选股的备注信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = WatchlistItemDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "备注过长"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权更新该自选股"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "自选股不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/{id}/notes")
    public ApiResponse<WatchlistItemDto> updateNotes(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @Parameter(description = "自选股ID", example = "1")
            @PathVariable @Positive Long id,
            @Parameter(description = "备注内容，最多500字符", example = "看好长期发展")
            @RequestBody @NotNull @Size(max = 500, message = "Notes too long") String notes) {
        Long userId = requireUserId(userPrincipal);
        log.debug("PUT /api/v1/watchlist/{}/notes: user={}", id, userId);
        WatchlistItemDto item = watchlistService.updateNotes(userId, id, notes);
        return ApiResponse.success(item);
    }

    private Long requireUserId(AuthUserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
