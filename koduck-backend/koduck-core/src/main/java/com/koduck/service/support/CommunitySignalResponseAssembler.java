package com.koduck.service.support;

import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.dto.community.SignalSubscriptionResponse;
import com.koduck.entity.auth.User;
import com.koduck.entity.community.CommunitySignal;
import com.koduck.entity.community.SignalComment;
import com.koduck.entity.community.SignalSubscription;
import com.koduck.repository.auth.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 组装社区信号相关响应DTO。
 *
 * @author Koduck Team
 */
@Component
@RequiredArgsConstructor
public class CommunitySignalResponseAssembler {

    /** 用户数据访问仓库。 */
    private final UserRepository userRepository;

    /**
     * 将CommunitySignal实体转换为SignalResponse DTO。
     *
     * @param signal              社区信号实体
     * @param likedSignalIds      已点赞信号ID集合
     * @param favoritedSignalIds  已收藏信号ID集合
     * @param subscribedSignalIds 已订阅信号ID集合
     * @return 信号响应DTO
     */
    public SignalResponse toSignalResponse(
            CommunitySignal signal,
            Set<Long> likedSignalIds,
            Set<Long> favoritedSignalIds,
            Set<Long> subscribedSignalIds) {
        User user = resolveSignalUser(signal);
        return SignalResponse.builder()
            .id(signal.getId())
            .userId(signal.getUserId())
            .username(user != null ? user.getUsername() : null)
            .avatarUrl(user != null ? user.getAvatarUrl() : null)
            .strategyId(signal.getStrategyId())
            .symbol(signal.getSymbol())
            .signalType(signal.getSignalType() != null
                    ? signal.getSignalType().name() : null)
            .reason(signal.getReason())
            .targetPrice(signal.getTargetPrice())
            .stopLoss(signal.getStopLoss())
            .timeFrame(signal.getTimeframe())
            .confidence(signal.getConfidence())
            .status(signal.getStatus() != null ? signal.getStatus().name() : null)
            .resultStatus(signal.getResultStatus() != null
                    ? signal.getResultStatus().name() : null)
            .resultProfit(signal.getResultProfit())
            .expiresAt(signal.getExpiresAt())
            .likeCount(signal.getLikeCount())
            .favoriteCount(signal.getFavoriteCount())
            .subscribeCount(signal.getSubscribeCount())
            .commentCount(signal.getCommentCount())
            .viewCount(signal.getViewCount())
            .isFeatured(signal.getIsFeatured())
            .tags(signal.getTags())
            .isLiked(likedSignalIds.contains(signal.getId()))
            .isFavorited(favoritedSignalIds.contains(signal.getId()))
            .isSubscribed(subscribedSignalIds.contains(signal.getId()))
            .createdAt(signal.getCreatedAt())
            .updatedAt(signal.getUpdatedAt())
            .build();
    }

    /**
     * 解析给定信号的用户。
     *
     * @param signal 社区信号
     * @return 用户实体，如未找到则返回null
     */
    private User resolveSignalUser(CommunitySignal signal) {
        Objects.requireNonNull(signal, "signal must not be null");
        User user = signal.getUser();
        if (user != null) {
            return user;
        }
        Long userId = Objects.requireNonNull(
                signal.getUserId(), "signal userId must not be null");
        return userRepository.findById(userId).orElse(null);
    }

    /**
     * 将SignalSubscription实体转换为SignalSubscriptionResponse DTO。
     *
     * @param subscription 信号订阅实体
     * @param signal       社区信号实体
     * @return 订阅响应DTO
     */
    public SignalSubscriptionResponse toSubscriptionResponse(
            SignalSubscription subscription,
            CommunitySignal signal) {
        User user = userRepository.findById(
            Objects.requireNonNull(
                    subscription.getUserId(),
                    "subscription userId must not be null"))
            .orElse(null);
        return SignalSubscriptionResponse.builder()
            .id(subscription.getId())
            .signalId(subscription.getSignalId())
            .symbol(signal != null ? signal.getSymbol() : null)
            .signalType(signal != null && signal.getSignalType() != null
                    ? signal.getSignalType().name() : null)
            .reason(signal != null ? signal.getReason() : null)
            .userId(subscription.getUserId())
            .username(user != null ? user.getUsername() : null)
            .notifyEnabled(subscription.getNotifyEnabled())
            .createdAt(subscription.getCreatedAt())
            .build();
    }

    /**
     * 将SignalComment实体转换为CommentResponse DTO。
     *
     * @param comment 信号评论实体
     * @param replies 回复评论列表
     * @return 评论响应DTO
     */
    public CommentResponse toCommentResponse(
            SignalComment comment,
            List<SignalComment> replies) {
        User user = userRepository.findById(
                Objects.requireNonNull(
                        comment.getUserId(),
                        "comment userId must not be null"))
            .orElse(null);
        List<CommentResponse> replyResponses = replies != null
            ? replies.stream().map(reply -> toCommentResponse(reply, List.of()))
                    .toList()
            : List.of();
        return CommentResponse.builder()
            .id(comment.getId())
            .signalId(comment.getSignalId())
            .userId(comment.getUserId())
            .username(user != null ? user.getUsername() : null)
            .avatarUrl(user != null ? user.getAvatarUrl() : null)
            .parentId(comment.getParentId())
            .content(comment.getContent())
            .likeCount(comment.getLikeCount())
            .isDeleted(comment.getIsDeleted())
            .replies(replyResponses)
            .createdAt(comment.getCreatedAt())
            .updatedAt(comment.getUpdatedAt())
            .build();
    }
}
