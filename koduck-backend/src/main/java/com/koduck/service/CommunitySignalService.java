package com.koduck.service;
import java.math.BigDecimal;
import java.util.List;

import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.CreateCommentRequest;
import com.koduck.dto.community.CreateSignalRequest;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.dto.community.SignalSubscriptionResponse;
import com.koduck.dto.community.UpdateSignalRequest;
import com.koduck.dto.community.UserSignalStatsResponse;

/**
 * 社区信号服务接口。
 *
 * @author Koduck Team
 */
public interface CommunitySignalService {

    /**
     * 获取信号列表。
     *
     * @param currentUserId 当前用户ID
     * @param sort 排序方式
     * @param symbol 股票代码
     * @param type 信号类型
     * @param page 页码
     * @param size 每页大小
     * @return 信号列表响应
     */
    SignalListResponse getSignals(Long currentUserId, String sort, String symbol,
        String type, int page, int size);

    /**
     * 获取精选信号。
     *
     * @param currentUserId 当前用户ID
     * @return 精选信号列表
     */
    List<SignalResponse> getFeaturedSignals(Long currentUserId);

    /**
     * 获取信号详情。
     *
     * @param currentUserId 当前用户ID
     * @param signalId 信号ID
     * @return 信号详情
     */
    SignalResponse getSignal(Long currentUserId, Long signalId);

    /**
     * 获取用户发布的信号。
     *
     * @param currentUserId 当前用户ID
     * @param userId 用户ID
     * @return 用户信号列表
     */
    List<SignalResponse> getUserSignals(Long currentUserId, Long userId);

    /**
     * 创建信号。
     *
     * @param userId 用户ID
     * @param request 创建信号请求
     * @return 创建的信号
     */
    SignalResponse createSignal(Long userId, CreateSignalRequest request);

    /**
     * 更新信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     * @param request 更新信号请求
     * @return 更新后的信号
     */
    SignalResponse updateSignal(Long userId, Long signalId, UpdateSignalRequest request);

    /**
     * 关闭信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     * @param resultStatus 结果状态
     * @param resultProfit 结果收益
     * @return 关闭的信号
     */
    SignalResponse closeSignal(Long userId, Long signalId, String resultStatus,
        BigDecimal resultProfit);

    /**
     * 删除信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     */
    void deleteSignal(Long userId, Long signalId);

    /**
     * 订阅信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     * @return 订阅响应
     */
    SignalSubscriptionResponse subscribeSignal(Long userId, Long signalId);

    /**
     * 取消订阅信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     */
    void unsubscribeSignal(Long userId, Long signalId);

    /**
     * 获取我的订阅。
     *
     * @param userId 用户ID
     * @return 订阅列表
     */
    List<SignalSubscriptionResponse> getMySubscriptions(Long userId);

    /**
     * 点赞信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     */
    void likeSignal(Long userId, Long signalId);

    /**
     * 取消点赞信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     */
    void unlikeSignal(Long userId, Long signalId);

    /**
     * 收藏信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     * @param note 备注
     */
    void favoriteSignal(Long userId, Long signalId, String note);

    /**
     * 取消收藏信号。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     */
    void unfavoriteSignal(Long userId, Long signalId);

    /**
     * 获取评论列表。
     *
     * @param signalId 信号ID
     * @param page 页码
     * @param size 每页大小
     * @return 评论列表
     */
    List<CommentResponse> getComments(Long signalId, int page, int size);

    /**
     * 创建评论。
     *
     * @param userId 用户ID
     * @param signalId 信号ID
     * @param request 创建评论请求
     * @return 创建的评论
     */
    CommentResponse createComment(Long userId, Long signalId, CreateCommentRequest request);

    /**
     * 删除评论。
     *
     * @param userId 用户ID
     * @param commentId 评论ID
     */
    void deleteComment(Long userId, Long commentId);

    /**
     * 获取用户统计。
     *
     * @param userId 用户ID
     * @return 用户信号统计
     */
    UserSignalStatsResponse getUserStats(Long userId);
}
