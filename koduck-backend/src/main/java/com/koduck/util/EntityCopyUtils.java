package com.koduck.util;

import com.koduck.entity.CommunitySignal;
import com.koduck.entity.SignalComment;
import com.koduck.entity.User;
import java.util.List;

/**
 * Entity defensive copy helpers.
 */
public final class EntityCopyUtils {

    private EntityCopyUtils() {
    }

    public static User copyUser(User source) {
        if (source == null) {
            return null;
        }
        return User.builder()
                .id(source.getId())
                .username(source.getUsername())
                .email(source.getEmail())
                .passwordHash(source.getPasswordHash())
                .nickname(source.getNickname())
                .avatarUrl(source.getAvatarUrl())
                .status(source.getStatus())
                .emailVerifiedAt(source.getEmailVerifiedAt())
                .lastLoginAt(source.getLastLoginAt())
                .lastLoginIp(source.getLastLoginIp())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .build();
    }

    public static CommunitySignal copyCommunitySignal(CommunitySignal source) {
        if (source == null) {
            return null;
        }
        return CommunitySignal.builder()
                .id(source.getId())
                .userId(source.getUserId())
                .strategyId(source.getStrategyId())
                .symbol(source.getSymbol())
                .signalType(source.getSignalType())
                .reason(source.getReason())
                .targetPrice(source.getTargetPrice())
                .stopLoss(source.getStopLoss())
                .timeFrame(source.getTimeFrame())
                .confidence(source.getConfidence())
                .status(source.getStatus())
                .resultStatus(source.getResultStatus())
                .resultProfit(source.getResultProfit())
                .expiresAt(source.getExpiresAt())
                .likeCount(source.getLikeCount())
                .favoriteCount(source.getFavoriteCount())
                .subscribeCount(source.getSubscribeCount())
                .commentCount(source.getCommentCount())
                .viewCount(source.getViewCount())
                .isFeatured(source.getIsFeatured())
                .tags(CollectionCopyUtils.copyList(source.getTags()))
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .user(copyUser(source.getUser()))
                .build();
    }

    public static SignalComment copySignalComment(SignalComment source) {
        if (source == null) {
            return null;
        }
        return SignalComment.builder()
                .id(source.getId())
                .signalId(source.getSignalId())
                .userId(source.getUserId())
                .parentId(source.getParentId())
                .content(source.getContent())
                .likeCount(source.getLikeCount())
                .isDeleted(source.getIsDeleted())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .signal(copyCommunitySignal(source.getSignal()))
                .user(copyUser(source.getUser()))
                .parent(copySignalCommentShallow(source.getParent()))
                .replies(copySignalCommentShallowList(source.getReplies()))
                .build();
    }

    public static SignalComment copySignalCommentShallow(SignalComment source) {
        if (source == null) {
            return null;
        }
        return SignalComment.builder()
                .id(source.getId())
                .signalId(source.getSignalId())
                .userId(source.getUserId())
                .parentId(source.getParentId())
                .content(source.getContent())
                .likeCount(source.getLikeCount())
                .isDeleted(source.getIsDeleted())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .signal(copyCommunitySignal(source.getSignal()))
                .user(copyUser(source.getUser()))
                .build();
    }

    public static List<SignalComment> copySignalCommentShallowList(List<SignalComment> source) {
        return source == null ? null : source.stream().map(EntityCopyUtils::copySignalCommentShallow).toList();
    }
}