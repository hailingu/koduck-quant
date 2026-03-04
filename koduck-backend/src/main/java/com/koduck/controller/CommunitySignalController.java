package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.community.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CommunitySignalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 社区信号控制器
 */
@RestController
@RequestMapping("/api/v1/community")
@RequiredArgsConstructor
@Tag(name = "社区信号", description = "策略信号分享、订阅、点赞、评论等社区功能接口")
@Slf4j
public class CommunitySignalController {

    private final CommunitySignalService signalService;

    // ========== 信号列表与查询 ==========

    /**
     * 获取信号列表
     */
    @GetMapping("/signals")
    public ApiResponse<SignalListResponse> getSignals(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "new") String sort,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long currentUserId = userPrincipal != null ? userPrincipal.getUser().getId() : null;
        log.info("获取信号列表: sort={}, symbol={}, type={}", sort, symbol, type);

        SignalListResponse response = signalService.getSignals(currentUserId, sort, symbol, type, page, size);
        return ApiResponse.success(response);
    }

    /**
     * 获取推荐信号
     */
    @GetMapping("/signals/featured")
    public ApiResponse<List<SignalResponse>> getFeaturedSignals(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long currentUserId = userPrincipal != null ? userPrincipal.getUser().getId() : null;
        log.info("获取推荐信号");

        List<SignalResponse> signals = signalService.getFeaturedSignals(currentUserId);
        return ApiResponse.success(signals);
    }

    /**
     * 获取信号详情
     */
    @GetMapping("/signals/{id}")
    public ApiResponse<SignalResponse> getSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long currentUserId = userPrincipal != null ? userPrincipal.getUser().getId() : null;
        log.info("获取信号详情: id={}", id);

        SignalResponse signal = signalService.getSignal(currentUserId, id);
        return ApiResponse.success(signal);
    }

    /**
     * 获取用户的信号列表
     */
    @GetMapping("/users/{userId}/signals")
    public ApiResponse<List<SignalResponse>> getUserSignals(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long userId) {

        Long currentUserId = userPrincipal != null ? userPrincipal.getUser().getId() : null;
        log.info("获取用户信号列表: userId={}", userId);

        List<SignalResponse> signals = signalService.getUserSignals(currentUserId, userId);
        return ApiResponse.success(signals);
    }

    // ========== 信号发布与更新 ==========

    /**
     * 发布信号
     */
    @PostMapping("/signals")
    public ApiResponse<SignalResponse> createSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateSignalRequest request) {

        Long userId = userPrincipal.getUser().getId();
        log.info("发布信号: userId={}, symbol={}", userId, request.getSymbol());

        SignalResponse signal = signalService.createSignal(userId, request);
        return ApiResponse.success(signal);
    }

    /**
     * 更新信号
     */
    @PutMapping("/signals/{id}")
    public ApiResponse<SignalResponse> updateSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateSignalRequest request) {

        Long userId = userPrincipal.getUser().getId();
        log.info("更新信号: userId={}, id={}", userId, id);

        SignalResponse signal = signalService.updateSignal(userId, id, request);
        return ApiResponse.success(signal);
    }

    /**
     * 关闭信号
     */
    @PostMapping("/signals/{id}/close")
    public ApiResponse<SignalResponse> closeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @RequestParam String resultStatus,
            @RequestParam(required = false) BigDecimal resultProfit) {

        Long userId = userPrincipal.getUser().getId();
        log.info("关闭信号: userId={}, id={}, result={}", userId, id, resultStatus);

        SignalResponse signal = signalService.closeSignal(userId, id, resultStatus, resultProfit);
        return ApiResponse.success(signal);
    }

    /**
     * 删除信号
     */
    @DeleteMapping("/signals/{id}")
    public ApiResponse<Void> deleteSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("删除信号: userId={}, id={}", userId, id);

        signalService.deleteSignal(userId, id);
        return new ApiResponse<>(0, "删除成功", null);
    }

    // ========== 订阅功能 ==========

    /**
     * 订阅信号
     */
    @PostMapping("/signals/{id}/subscribe")
    public ApiResponse<SignalSubscriptionResponse> subscribeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("订阅信号: userId={}, id={}", userId, id);

        SignalSubscriptionResponse response = signalService.subscribeSignal(userId, id);
        return ApiResponse.success(response);
    }

    /**
     * 取消订阅
     */
    @DeleteMapping("/signals/{id}/subscribe")
    public ApiResponse<Void> unsubscribeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("取消订阅: userId={}, id={}", userId, id);

        signalService.unsubscribeSignal(userId, id);
        return new ApiResponse<>(0, "取消订阅成功", null);
    }

    /**
     * 获取我的订阅列表
     */
    @GetMapping("/subscriptions")
    public ApiResponse<List<SignalSubscriptionResponse>> getMySubscriptions(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long userId = userPrincipal.getUser().getId();
        log.info("获取我的订阅: userId={}", userId);

        List<SignalSubscriptionResponse> subscriptions = signalService.getMySubscriptions(userId);
        return ApiResponse.success(subscriptions);
    }

    // ========== 点赞与收藏 ==========

    /**
     * 点赞信号
     */
    @PostMapping("/signals/{id}/like")
    public ApiResponse<Void> likeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("点赞信号: userId={}, id={}", userId, id);

        signalService.likeSignal(userId, id);
        return new ApiResponse<>(0, "点赞成功", null);
    }

    /**
     * 取消点赞
     */
    @DeleteMapping("/signals/{id}/like")
    public ApiResponse<Void> unlikeSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("取消点赞: userId={}, id={}", userId, id);

        signalService.unlikeSignal(userId, id);
        return new ApiResponse<>(0, "取消点赞成功", null);
    }

    /**
     * 收藏信号
     */
    @PostMapping("/signals/{id}/favorite")
    public ApiResponse<Void> favoriteSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @RequestParam(required = false) String note) {

        Long userId = userPrincipal.getUser().getId();
        log.info("收藏信号: userId={}, id={}", userId, id);

        signalService.favoriteSignal(userId, id, note);
        return new ApiResponse<>(0, "收藏成功", null);
    }

    /**
     * 取消收藏
     */
    @DeleteMapping("/signals/{id}/favorite")
    public ApiResponse<Void> unfavoriteSignal(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("取消收藏: userId={}, id={}", userId, id);

        signalService.unfavoriteSignal(userId, id);
        return new ApiResponse<>(0, "取消收藏成功", null);
    }

    // ========== 评论功能 ==========

    /**
     * 获取评论列表
     */
    @GetMapping("/signals/{id}/comments")
    public ApiResponse<List<CommentResponse>> getComments(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("获取评论列表: signalId={}", id);

        List<CommentResponse> comments = signalService.getComments(id, page, size);
        return ApiResponse.success(comments);
    }

    /**
     * 发布评论
     */
    @PostMapping("/signals/{id}/comments")
    public ApiResponse<CommentResponse> createComment(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody CreateCommentRequest request) {

        Long userId = userPrincipal.getUser().getId();
        log.info("发布评论: userId={}, signalId={}", userId, id);

        CommentResponse comment = signalService.createComment(userId, id, request);
        return ApiResponse.success(comment);
    }

    /**
     * 删除评论
     */
    @DeleteMapping("/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long commentId) {

        Long userId = userPrincipal.getUser().getId();
        log.info("删除评论: userId={}, commentId={}", userId, commentId);

        signalService.deleteComment(userId, commentId);
        return new ApiResponse<>(0, "删除成功", null);
    }

    // ========== 用户统计 ==========

    /**
     * 获取用户信号统计
     */
    @GetMapping("/users/{userId}/stats")
    public ApiResponse<UserSignalStatsResponse> getUserStats(
            @PathVariable Long userId) {

        log.info("获取用户统计: userId={}", userId);

        UserSignalStatsResponse stats = signalService.getUserStats(userId);
        return ApiResponse.success(stats);
    }
}
