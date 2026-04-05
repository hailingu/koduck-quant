package com.koduck.util;

import java.util.List;

import com.koduck.entity.community.CommunitySignal;
import com.koduck.entity.community.SignalComment;

/**
 * Community entity defensive copy helpers.
 *
 * @author GitHub Copilot
 */
public final class CommunityEntityCopyUtils {

    private CommunityEntityCopyUtils() {
    }

    /**
     * Creates a detached copy of a community signal.
     *
     * @param source source entity
     * @return copied signal or null when source is null
     */
    public static CommunitySignal copyCommunitySignal(final CommunitySignal source) {
        CommunitySignal copied = null;
        if (source == null) {
            return copied;
        }
        copied = CommunitySignal.builder()
                .id(source.getId())
                .userId(source.getUserId())
                .strategyId(source.getStrategyId())
                .symbol(source.getSymbol())
                .signalType(source.getSignalType())
                .reason(source.getReason())
                .targetPrice(source.getTargetPrice())
                .stopLoss(source.getStopLoss())
                .timeFrame(source.getTimeframe())
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
                .user(EntityCopyUtils.copyUser(source.getUser()))
                .build();
        return copied;
    }

    /**
     * Creates a detached copy of a signal comment including shallow relations.
     *
     * @param source source entity
     * @return copied comment or null when source is null
     */
    public static SignalComment copySignalComment(final SignalComment source) {
        SignalComment copied = null;
        if (source == null) {
            return copied;
        }
        copied = SignalComment.builder()
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
                .user(EntityCopyUtils.copyUser(source.getUser()))
                .parent(copySignalCommentShallow(source.getParent()))
                .replies(copySignalCommentShallowList(source.getReplies()))
                .build();
        return copied;
    }

    /**
     * Creates a shallow detached copy of a signal comment.
     *
     * @param source source entity
     * @return shallow copied comment or null when source is null
     */
    public static SignalComment copySignalCommentShallow(final SignalComment source) {
        SignalComment copied = null;
        if (source == null) {
            return copied;
        }
        copied = SignalComment.builder()
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
                .user(EntityCopyUtils.copyUser(source.getUser()))
                .build();
        return copied;
    }

    /**
     * Creates shallow detached copies of a comment list.
     *
     * @param source source list
     * @return copied list or null when source is null
     */
    public static List<SignalComment> copySignalCommentShallowList(final List<SignalComment> source) {
        List<SignalComment> copied = null;
        if (source != null) {
            copied = source.stream().map(CommunityEntityCopyUtils::copySignalCommentShallow).toList();
        }
        return copied;
    }
}
