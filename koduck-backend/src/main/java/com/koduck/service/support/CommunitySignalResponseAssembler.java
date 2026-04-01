package com.koduck.service.support;

import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.dto.community.SignalSubscriptionResponse;
import com.koduck.entity.CommunitySignal;
import com.koduck.entity.SignalComment;
import com.koduck.entity.SignalSubscription;
import com.koduck.entity.User;
import com.koduck.repository.UserRepository;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Assembles community signal-related response DTOs.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
@RequiredArgsConstructor
public class CommunitySignalResponseAssembler {

    private final UserRepository userRepository;

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
            .signalType(signal.getSignalType() != null ? signal.getSignalType().name() : null)
            .reason(signal.getReason())
            .targetPrice(signal.getTargetPrice())
            .stopLoss(signal.getStopLoss())
            .timeFrame(signal.getTimeframe())
            .confidence(signal.getConfidence())
            .status(signal.getStatus() != null ? signal.getStatus().name() : null)
            .resultStatus(signal.getResultStatus() != null ? signal.getResultStatus().name() : null)
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

    private User resolveSignalUser(CommunitySignal signal) {
        Objects.requireNonNull(signal, "signal must not be null");
        User user = signal.getUser();
        if (user != null) {
            return user;
        }
        Long userId = Objects.requireNonNull(signal.getUserId(), "signal userId must not be null");
        return userRepository.findById(userId).orElse(null);
    }

    public SignalSubscriptionResponse toSubscriptionResponse(SignalSubscription subscription, CommunitySignal signal) {
        User user = userRepository.findById(
            Objects.requireNonNull(subscription.getUserId(), "subscription userId must not be null"))
            .orElse(null);
        return SignalSubscriptionResponse.builder()
            .id(subscription.getId())
            .signalId(subscription.getSignalId())
            .symbol(signal != null ? signal.getSymbol() : null)
            .signalType(signal != null && signal.getSignalType() != null ? signal.getSignalType().name() : null)
            .reason(signal != null ? signal.getReason() : null)
            .userId(subscription.getUserId())
            .username(user != null ? user.getUsername() : null)
            .notifyEnabled(subscription.getNotifyEnabled())
            .createdAt(subscription.getCreatedAt())
            .build();
    }

    public CommentResponse toCommentResponse(SignalComment comment, List<SignalComment> replies) {
        User user = userRepository.findById(Objects.requireNonNull(comment.getUserId(), "comment userId must not be null"))
            .orElse(null);
        List<CommentResponse> replyResponses = replies != null
            ? replies.stream().map(reply -> toCommentResponse(reply, List.of())).toList()
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
