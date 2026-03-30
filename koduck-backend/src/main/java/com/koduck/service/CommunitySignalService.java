package com.koduck.service;

import com.koduck.dto.community.*;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * 社区信号服务接口
 */
public interface CommunitySignalService {

    /**
     * 获取信号列表
     */
    SignalListResponse getSignals(Long currentUserId, String sort, String symbol, String type, int page, int size);

    /**
     * 获取精选信号
     */
    List<SignalResponse> getFeaturedSignals(Long currentUserId);

    /**
     * 获取信号详情
     */
    @Transactional
    SignalResponse getSignal(Long currentUserId, Long signalId);

    /**
     * 获取用户发布的信号
     */
    List<SignalResponse> getUserSignals(Long currentUserId, Long userId);

    /**
     * 创建信号
     */
    @Transactional
    SignalResponse createSignal(Long userId, CreateSignalRequest request);

    /**
     * 更新信号
     */
    @Transactional
    SignalResponse updateSignal(Long userId, Long signalId, UpdateSignalRequest request);

    /**
     * 关闭信号
     */
    @Transactional
    SignalResponse closeSignal(Long userId, Long signalId, String resultStatus, BigDecimal resultProfit);

    /**
     * 删除信号
     */
    @Transactional
    void deleteSignal(Long userId, Long signalId);

    /**
     * 订阅信号
     */
    @Transactional
    SignalSubscriptionResponse subscribeSignal(Long userId, Long signalId);

    /**
     * 取消订阅信号
     */
    @Transactional
    void unsubscribeSignal(Long userId, Long signalId);

    /**
     * 获取我的订阅
     */
    List<SignalSubscriptionResponse> getMySubscriptions(Long userId);

    /**
     * 点赞信号
     */
    @Transactional
    void likeSignal(Long userId, Long signalId);

    /**
     * 取消点赞信号
     */
    @Transactional
    void unlikeSignal(Long userId, Long signalId);

    /**
     * 收藏信号
     */
    @Transactional
    void favoriteSignal(Long userId, Long signalId, String note);

    /**
     * 取消收藏信号
     */
    @Transactional
    void unfavoriteSignal(Long userId, Long signalId);

    /**
     * 获取评论列表
     */
    List<CommentResponse> getComments(Long signalId, int page, int size);

    /**
     * 创建评论
     */
    @Transactional
    CommentResponse createComment(Long userId, Long signalId, CreateCommentRequest request);

    /**
     * 删除评论
     */
    @Transactional
    void deleteComment(Long userId, Long commentId);

    /**
     * 获取用户统计
     */
    UserSignalStatsResponse getUserStats(Long userId);
}
