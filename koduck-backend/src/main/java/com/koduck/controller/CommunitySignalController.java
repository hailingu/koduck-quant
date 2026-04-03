package com.koduck.controller;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.common.constants.PaginationConstants;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.CreateCommentRequest;
import com.koduck.dto.community.CreateSignalRequest;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.dto.community.SignalSubscriptionResponse;
import com.koduck.dto.community.UpdateSignalRequest;
import com.koduck.dto.community.UserSignalStatsResponse;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CommunitySignalService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST controller for community trading signals.
 *
 * <p>Provides endpoints for signal publishing, interaction, subscriptions,
 * comments, and user statistics.</p>
 *
 * @author GitHub Copilot
 */
@RestController
@RequestMapping("/api/v1/community")
@Tag(name = "社区信号", description = "策略信号分享、订阅、点赞、评论等社区功能接口")
@SecurityRequirement(name = "bearerAuth")
@Validated
@Slf4j
@RequiredArgsConstructor
public class CommunitySignalController {

    /** Message for successful deletion. */
    private static final String MESSAGE_DELETED_SUCCESSFULLY = "Deleted successfully";

    /** Message for successful unsubscription. */
    private static final String MESSAGE_UNSUBSCRIBED_SUCCESSFULLY = "Unsubscribed successfully";

    /** Message for successful like. */
    private static final String MESSAGE_LIKED_SUCCESSFULLY = "Liked successfully";

    /** Message for successful unlike. */
    private static final String MESSAGE_UNLIKED_SUCCESSFULLY = "Unliked successfully";

    /** Message for successful favorite. */
    private static final String MESSAGE_FAVORITED_SUCCESSFULLY = "Favorited successfully";

    /** Message for successful unfavorite. */
    private static final String MESSAGE_UNFAVORITED_SUCCESSFULLY = "Unfavorited successfully";

    /** Service for community signal operations. */
    private final CommunitySignalService signalService;

    /** Resolver for authenticated user information. */
    private final AuthenticatedUserResolver authenticatedUserResolver;

    /**
     * Retrieves signal list with filtering and paging.
     *
     * @param userPrincipal optional authenticated principal
     * @param sort sorting strategy, supported values: new or hot
     * @param symbol optional stock symbol filter
     * @param type optional signal type filter: BUY, SELL or HOLD
     * @param page zero-based page index
     * @param size page size between 1 and 100
     * @return paged signal list response
     */
    @Operation(
        summary = "获取信号列表",
        description = "获取社区信号列表，支持排序、筛选和分页"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = SignalListResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/signals")
    public ApiResponse<SignalListResponse> getSignals(
            @Parameter(description = "当前用户认证信息（可选）", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "排序方式", example = "new",
                schema = @Schema(allowableValues = {"new", "hot"}))
            @RequestParam(defaultValue = "new")
            @Pattern(regexp = "new|hot", message = "sort must be 'new' or 'hot'") String sort,
            @Parameter(description = "股票代码筛选", example = "600519")
            @RequestParam(required = false) String symbol,
            @Parameter(description = "信号类型筛选", example = "BUY",
                schema = @Schema(allowableValues = {"BUY", "SELL", "HOLD"}))
            @RequestParam(required = false)
            @Pattern(regexp = "BUY|SELL|HOLD", message = "type must be BUY, SELL or HOLD") String type,
            @Parameter(description = "页码，从0开始", example = "0")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ZERO_STR)
            @Min(value = PaginationConstants.DEFAULT_PAGE_ZERO, message = "page must be >= 0") int page,
            @Parameter(description = "每页数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR)
            @Min(value = 1, message = "size must be >= 1")
            @Max(value = PaginationConstants.MAX_PAGE_SIZE, message = "size must be <= 100") int size) {
        Long currentUserId = authenticatedUserResolver.getOptionalUserId(userPrincipal);
        log.info("Get signals: sort={}, symbol={}, type={}", sort, symbol, type);
        SignalListResponse response = signalService.getSignals(currentUserId, sort, symbol, type, page, size);
        return ApiResponse.success(response);
    }

    /**
     * Retrieves featured signals.
     *
     * @param userPrincipal optional authenticated principal
     * @return featured signal list
     */
    @Operation(
        summary = "获取精选信号",
        description = "获取社区精选的优质信号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = SignalResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/signals/featured")
    public ApiResponse<List<SignalResponse>> getFeaturedSignals(
            @Parameter(description = "当前用户认证信息（可选）", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long currentUserId = authenticatedUserResolver.getOptionalUserId(userPrincipal);
        log.info("Get featured signals");
        List<SignalResponse> signals = signalService.getFeaturedSignals(currentUserId);
        return ApiResponse.success(signals);
    }

    /**
     * Retrieves details of a specific signal.
     *
     * @param userPrincipal optional authenticated principal
     * @param id signal identifier
     * @return signal detail response
     */
    @Operation(
        summary = "获取信号详情",
        description = "获取指定ID的信号详细信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = SignalResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/signals/{id}")
    public ApiResponse<SignalResponse> getSignal(
            @Parameter(description = "当前用户认证信息（可选）", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long currentUserId = authenticatedUserResolver.getOptionalUserId(userPrincipal);
        log.info("Get signal detail: id={}", id);
        SignalResponse signal = signalService.getSignal(currentUserId, id);
        return ApiResponse.success(signal);
    }

    /**
     * Retrieves all signals published by a user.
     *
     * @param userPrincipal optional authenticated principal
     * @param userId publisher user identifier
     * @return user signal list
     */
    @Operation(
        summary = "获取用户信号",
        description = "获取指定用户发布的所有信号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = SignalResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "用户不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/users/{userId}/signals")
    public ApiResponse<List<SignalResponse>> getUserSignals(
            @Parameter(description = "当前用户认证信息（可选）", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "用户ID", example = "1")
            @PathVariable @Positive(message = "userId must be positive") Long userId) {
        Long currentUserId = authenticatedUserResolver.getOptionalUserId(userPrincipal);
        log.info("Get user signals: userId={}", userId);
        List<SignalResponse> signals = signalService.getUserSignals(currentUserId, userId);
        return ApiResponse.success(signals);
    }

    /**
     * Creates a new community signal.
     *
     * @param userPrincipal authenticated principal
     * @param request signal creation request payload
     * @return created signal response
     */
    @Operation(
        summary = "创建信号",
        description = "发布新的交易信号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "创建成功",
                content = @Content(schema = @Schema(implementation = SignalResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/signals")
    public ApiResponse<SignalResponse> createSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateSignalRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.info("Create signal: userId={}, symbol={}", userId, request.getSymbol());
        SignalResponse signal = signalService.createSignal(userId, request);
        return ApiResponse.success(signal);
    }

    /**
     * Updates an existing signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @param request update payload
     * @return updated signal response
     */
    @Operation(
        summary = "更新信号",
        description = "更新指定ID的信号信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "更新成功",
                content = @Content(schema = @Schema(implementation = SignalResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权更新该信号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/signals/{id}")
    public ApiResponse<SignalResponse> updateSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Valid @RequestBody UpdateSignalRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.info("Update signal: userId={}, id={}", userId, id);
        SignalResponse signal = signalService.updateSignal(userId, id, request);
        return ApiResponse.success(signal);
    }

    /**
     * Closes a signal and records its result.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @param resultStatus result status: HIT_TARGET, HIT_STOP or TIMEOUT
     * @param resultProfit optional profit result
     * @return closed signal response
     */
    @Operation(
        summary = "关闭信号",
        description = "关闭信号并记录结果"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "关闭成功",
                content = @Content(schema = @Schema(implementation = SignalResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权关闭该信号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/signals/{id}/close")
    public ApiResponse<SignalResponse> closeSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Parameter(description = "结果状态", example = "HIT_TARGET",
                schema = @Schema(allowableValues = {"HIT_TARGET", "HIT_STOP", "TIMEOUT"}))
            @RequestParam
            @Pattern(regexp = "HIT_TARGET|HIT_STOP|TIMEOUT", message = "invalid resultStatus")
            String resultStatus,
            @Parameter(description = "收益金额（可选）", example = "1000.00")
            @RequestParam(required = false) BigDecimal resultProfit) {
        Long userId = requireUserId(userPrincipal);
        log.info("Close signal: userId={}, id={}, resultStatus={}", userId, id, resultStatus);
        SignalResponse signal = signalService.closeSignal(userId, id, resultStatus, resultProfit);
        return ApiResponse.success(signal);
    }

    /**
     * Deletes a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @return empty success response
     */
    @Operation(
        summary = "删除信号",
        description = "删除指定ID的信号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该信号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/signals/{id}")
    public ApiResponse<Void> deleteSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Delete signal: userId={}, id={}", userId, id);
        signalService.deleteSignal(userId, id);
        return ApiResponse.successMessage(MESSAGE_DELETED_SUCCESSFULLY);
    }

    /**
     * Subscribes current user to a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @return subscription response
     */
    @Operation(
        summary = "订阅信号",
        description = "订阅指定信号，接收更新通知"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "订阅成功",
                content = @Content(schema = @Schema(implementation = SignalSubscriptionResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "已经订阅该信号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/signals/{id}/subscribe")
    public ApiResponse<SignalSubscriptionResponse> subscribeSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Subscribe signal: userId={}, id={}", userId, id);
        SignalSubscriptionResponse response = signalService.subscribeSignal(userId, id);
        return ApiResponse.success(response);
    }

    /**
     * Unsubscribes current user from a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @return empty success response
     */
    @Operation(
        summary = "取消订阅信号",
        description = "取消对指定信号的订阅"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "取消订阅成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "未订阅该信号或信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/signals/{id}/subscribe")
    public ApiResponse<Void> unsubscribeSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Unsubscribe signal: userId={}, id={}", userId, id);
        signalService.unsubscribeSignal(userId, id);
        return ApiResponse.successMessage(MESSAGE_UNSUBSCRIBED_SUCCESSFULLY);
    }

    /**
     * Retrieves subscriptions of current user.
     *
     * @param userPrincipal authenticated principal
     * @return list of subscriptions
     */
    @Operation(
        summary = "获取我的订阅",
        description = "获取当前用户订阅的所有信号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = SignalSubscriptionResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/subscriptions")
    public ApiResponse<List<SignalSubscriptionResponse>> getMySubscriptions(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.info("Get my subscriptions: userId={}", userId);
        List<SignalSubscriptionResponse> subscriptions = signalService.getMySubscriptions(userId);
        return ApiResponse.success(subscriptions);
    }

    /**
     * Likes a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @return empty success response
     */
    @Operation(
        summary = "点赞信号",
        description = "为指定信号点赞"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "点赞成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "已经点赞过该信号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/signals/{id}/like")
    public ApiResponse<Void> likeSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Like signal: userId={}, id={}", userId, id);
        signalService.likeSignal(userId, id);
        return ApiResponse.successMessage(MESSAGE_LIKED_SUCCESSFULLY);
    }

    /**
     * Removes like from a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @return empty success response
     */
    @Operation(
        summary = "取消点赞",
        description = "取消对指定信号的点赞"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "取消点赞成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "未点赞过该信号或信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/signals/{id}/like")
    public ApiResponse<Void> unlikeSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Unlike signal: userId={}, id={}", userId, id);
        signalService.unlikeSignal(userId, id);
        return ApiResponse.successMessage(MESSAGE_UNLIKED_SUCCESSFULLY);
    }

    /**
     * Favorites a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @param note optional note for favorite
     * @return empty success response
     */
    @Operation(
        summary = "收藏信号",
        description = "收藏指定信号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "收藏成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "已经收藏过该信号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/signals/{id}/favorite")
    public ApiResponse<Void> favoriteSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Parameter(description = "收藏备注，最多200字符", example = "重点关注")
            @RequestParam(required = false) @Size(max = 200, message = "note length must be <= 200") String note) {
        Long userId = requireUserId(userPrincipal);
        log.info("Favorite signal: userId={}, id={}", userId, id);
        signalService.favoriteSignal(userId, id, note);
        return ApiResponse.successMessage(MESSAGE_FAVORITED_SUCCESSFULLY);
    }

    /**
     * Removes favorite from a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @return empty success response
     */
    @Operation(
        summary = "取消收藏",
        description = "取消对指定信号的收藏"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "取消收藏成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "未收藏过该信号或信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/signals/{id}/favorite")
    public ApiResponse<Void> unfavoriteSignal(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Unfavorite signal: userId={}, id={}", userId, id);
        signalService.unfavoriteSignal(userId, id);
        return ApiResponse.successMessage(MESSAGE_UNFAVORITED_SUCCESSFULLY);
    }

    /**
     * Retrieves comments of a signal.
     *
     * @param id signal identifier
     * @param page zero-based page index
     * @param size page size between 1 and 100
     * @return comment list
     */
    @Operation(
        summary = "获取信号评论",
        description = "获取指定信号的评论列表"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = CommentResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/signals/{id}/comments")
    public ApiResponse<List<CommentResponse>> getComments(
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Parameter(description = "页码，从0开始", example = "0")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ZERO_STR)
            @Min(value = PaginationConstants.DEFAULT_PAGE_ZERO, message = "page must be >= 0") int page,
            @Parameter(description = "每页数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR)
            @Min(value = 1, message = "size must be >= 1")
            @Max(value = PaginationConstants.MAX_PAGE_SIZE, message = "size must be <= 100") int size) {
        log.info("Get comments: signalId={}", id);
        List<CommentResponse> comments = signalService.getComments(id, page, size);
        return ApiResponse.success(comments);
    }

    /**
     * Creates a comment under a signal.
     *
     * @param userPrincipal authenticated principal
     * @param id signal identifier
     * @param request comment request payload
     * @return created comment response
     */
    @Operation(
        summary = "创建评论",
        description = "为指定信号添加评论"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "创建成功",
                content = @Content(schema = @Schema(implementation = CommentResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "信号不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/signals/{id}/comments")
    public ApiResponse<CommentResponse> createComment(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "信号ID", example = "1")
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Valid @RequestBody CreateCommentRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.info("Create comment: userId={}, signalId={}", userId, id);
        CommentResponse comment = signalService.createComment(userId, id, request);
        return ApiResponse.success(comment);
    }

    /**
     * Deletes a comment.
     *
     * @param userPrincipal authenticated principal
     * @param commentId comment identifier
     * @return empty success response
     */
    @Operation(
        summary = "删除评论",
        description = "删除指定ID的评论"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该评论"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "评论不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "评论ID", example = "1")
            @PathVariable @Positive(message = "commentId must be positive") Long commentId) {
        Long userId = requireUserId(userPrincipal);
        log.info("Delete comment: userId={}, commentId={}", userId, commentId);
        signalService.deleteComment(userId, commentId);
        return ApiResponse.successMessage(MESSAGE_DELETED_SUCCESSFULLY);
    }

    /**
     * Retrieves signal statistics of a user.
     *
     * @param userId user identifier
     * @return user signal statistics
     */
    @Operation(
        summary = "获取用户信号统计",
        description = "获取指定用户的信号发布统计"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = UserSignalStatsResponse.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "用户不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/users/{userId}/stats")
    public ApiResponse<UserSignalStatsResponse> getUserStats(
            @Parameter(description = "用户ID", example = "1")
            @PathVariable @Positive(message = "userId must be positive") Long userId) {
        log.info("Get user stats: userId={}", userId);
        UserSignalStatsResponse stats = signalService.getUserStats(userId);
        return ApiResponse.success(stats);
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
