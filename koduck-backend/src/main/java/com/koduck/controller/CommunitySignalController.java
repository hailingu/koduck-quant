package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.CreateCommentRequest;
import com.koduck.dto.community.CreateSignalRequest;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.dto.community.SignalSubscriptionResponse;
import com.koduck.dto.community.UpdateSignalRequest;
import com.koduck.dto.community.UserSignalStatsResponse;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CommunitySignalService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * REST controller for community trading signals.
 *
 * <p>Provides endpoints for signal publishing, interaction, subscriptions,
 * comments, and user statistics.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@RestController
@RequestMapping("/api/v1/community")
@RequiredArgsConstructor
@Tag(name = "社区信号", description = "策略信号分享、订阅、点赞、评论等社区功能接口")
@Validated
@Slf4j
public class CommunitySignalController {

    private static final String MESSAGE_DELETED_SUCCESSFULLY = "Deleted successfully";
    private static final String MESSAGE_UNSUBSCRIBED_SUCCESSFULLY = "Unsubscribed successfully";
    private static final String MESSAGE_LIKED_SUCCESSFULLY = "Liked successfully";
    private static final String MESSAGE_UNLIKED_SUCCESSFULLY = "Unliked successfully";
    private static final String MESSAGE_FAVORITED_SUCCESSFULLY = "Favorited successfully";
    private static final String MESSAGE_UNFAVORITED_SUCCESSFULLY = "Unfavorited successfully";

    private final CommunitySignalService signalService;
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
    @GetMapping("/signals")
    public ApiResponse<SignalListResponse> getSignals(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "new")
            @Pattern(regexp = "new|hot", message = "sort must be 'new' or 'hot'") String sort,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false)
            @Pattern(regexp = "BUY|SELL|HOLD", message = "type must be BUY, SELL or HOLD") String type,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
            @Min(value = 1, message = "size must be >= 1")
            @Max(value = 100, message = "size must be <= 100") int size) {

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
    @GetMapping("/signals/featured")
    public ApiResponse<List<SignalResponse>> getFeaturedSignals(
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
    @GetMapping("/signals/{id}")
    public ApiResponse<SignalResponse> getSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @GetMapping("/users/{userId}/signals")
    public ApiResponse<List<SignalResponse>> getUserSignals(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @PostMapping("/signals")
    public ApiResponse<SignalResponse> createSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateSignalRequest request) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @PutMapping("/signals/{id}")
    public ApiResponse<SignalResponse> updateSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Valid @RequestBody UpdateSignalRequest request) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @PostMapping("/signals/{id}/close")
    public ApiResponse<SignalResponse> closeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id,
            @RequestParam
            @Pattern(regexp = "HIT_TARGET|HIT_STOP|TIMEOUT", message = "invalid resultStatus")
            String resultStatus,
            @RequestParam(required = false) BigDecimal resultProfit) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @DeleteMapping("/signals/{id}")
    public ApiResponse<Void> deleteSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @PostMapping("/signals/{id}/subscribe")
    public ApiResponse<SignalSubscriptionResponse> subscribeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @DeleteMapping("/signals/{id}/subscribe")
    public ApiResponse<Void> unsubscribeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @GetMapping("/subscriptions")
    public ApiResponse<List<SignalSubscriptionResponse>> getMySubscriptions(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @PostMapping("/signals/{id}/like")
    public ApiResponse<Void> likeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @DeleteMapping("/signals/{id}/like")
    public ApiResponse<Void> unlikeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @PostMapping("/signals/{id}/favorite")
    public ApiResponse<Void> favoriteSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id,
            @RequestParam(required = false) @Size(max = 200, message = "note length must be <= 200") String note) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @DeleteMapping("/signals/{id}/favorite")
    public ApiResponse<Void> unfavoriteSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @GetMapping("/signals/{id}/comments")
    public ApiResponse<List<CommentResponse>> getComments(
            @PathVariable @Positive(message = "id must be positive") Long id,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
            @Min(value = 1, message = "size must be >= 1")
            @Max(value = 100, message = "size must be <= 100") int size) {

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
    @PostMapping("/signals/{id}/comments")
    public ApiResponse<CommentResponse> createComment(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "id must be positive") Long id,
            @Valid @RequestBody CreateCommentRequest request) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @DeleteMapping("/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "commentId must be positive") Long commentId) {

        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
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
    @GetMapping("/users/{userId}/stats")
    public ApiResponse<UserSignalStatsResponse> getUserStats(
            @PathVariable @Positive(message = "userId must be positive") Long userId) {

        log.info("Get user stats: userId={}", userId);

        UserSignalStatsResponse stats = signalService.getUserStats(userId);
        return ApiResponse.success(stats);
    }

}
