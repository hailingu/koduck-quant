package com.koduck.service.impl;

import com.koduck.dto.community.*;
import com.koduck.entity.*;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.*;
import com.koduck.service.CommunitySignalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.koduck.util.ServiceValidationUtils.assertOwner;
import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * 社区信号服务实现
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CommunitySignalServiceImpl implements CommunitySignalService {

    private final CommunitySignalRepository signalRepository;
    private final SignalSubscriptionRepository subscriptionRepository;
    private final SignalLikeRepository likeRepository;
    private final SignalFavoriteRepository favoriteRepository;
    private final SignalCommentRepository commentRepository;
    private final UserSignalStatsRepository statsRepository;
    private final UserRepository userRepository;

    // ========== 信号查询 ==========

    /**
     * 获取信号列表
     */
    @Override
    public SignalListResponse getSignals(Long currentUserId, String sort, String symbol, String type, int page, int size) {
        log.info(": sort={}, symbol={}, type={}", sort, symbol, type);

        Pageable pageable = PageRequest.of(page, size);
        Page<CommunitySignal> signalPage;

        // 
        if ("hot".equalsIgnoreCase(sort)) {
            signalPage = signalRepository.findHotSignals(CommunitySignal.Status.ACTIVE, pageable);
        } else if (symbol != null && !symbol.isEmpty()) {
            signalPage = signalRepository.findBySymbolContainingAndStatus(symbol.toUpperCase(Locale.ROOT), CommunitySignal.Status.ACTIVE, pageable);
        } else if (type != null && !type.isEmpty()) {
            signalPage = signalRepository.findBySignalTypeAndStatus(
                    CommunitySignal.SignalType.valueOf(type.toUpperCase(Locale.ROOT)), CommunitySignal.Status.ACTIVE, pageable);
        } else {
            signalPage = signalRepository.findByStatus(CommunitySignal.Status.ACTIVE, 
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        }

        // 
        Set<Long> likedSignalIds = currentUserId != null ?
                likeRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();
        Set<Long> favoritedSignalIds = currentUserId != null ?
                favoriteRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();
        Set<Long> subscribedSignalIds = currentUserId != null ?
                subscriptionRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();

        List<SignalResponse> items = signalPage.getContent().stream()
                .map(s -> toSignalResponse(s, likedSignalIds, favoritedSignalIds, subscribedSignalIds))
                .collect(Collectors.toList());

        return SignalListResponse.builder()
                .items(items)
                .total(signalPage.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(signalPage.getTotalPages())
                .build();
    }

    /**
     * 获取精选信号
     */
    @Override
    public List<SignalResponse> getFeaturedSignals(Long currentUserId) {
        Pageable pageable = PageRequest.of(0, 5);
        Page<CommunitySignal> signals = signalRepository.findByIsFeaturedTrueAndStatus(pageable, CommunitySignal.Status.ACTIVE);

        Set<Long> likedSignalIds = currentUserId != null ?
                likeRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();
        Set<Long> favoritedSignalIds = currentUserId != null ?
                favoriteRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();
        Set<Long> subscribedSignalIds = currentUserId != null ?
                subscriptionRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();

        return signals.getContent().stream()
                .map(s -> toSignalResponse(s, likedSignalIds, favoritedSignalIds, subscribedSignalIds))
                .collect(Collectors.toList());
    }

    /**
     * 获取信号详情
     */
    @Override
    @Transactional
    public SignalResponse getSignal(Long currentUserId, Long signalId) {
        log.info(": signalId={}", signalId);

        CommunitySignal signal = loadSignalOrThrow(signalId);

        // 
        signalRepository.incrementViewCount(signalId);

        Set<Long> likedSignalIds = currentUserId != null && likeRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        Set<Long> favoritedSignalIds = currentUserId != null && favoriteRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        Set<Long> subscribedSignalIds = currentUserId != null && subscriptionRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();

        return toSignalResponse(signal, likedSignalIds, favoritedSignalIds, subscribedSignalIds);
    }

    /**
     * 获取用户发布的信号
     */
    @Override
    public List<SignalResponse> getUserSignals(Long currentUserId, Long userId) {
        log.info(": userId={}", userId);

        List<CommunitySignal> signals = signalRepository.findByUserIdOrderByCreatedAtDesc(userId);

        Set<Long> likedSignalIds = currentUserId != null ?
                likeRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();
        Set<Long> favoritedSignalIds = currentUserId != null ?
                favoriteRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();
        Set<Long> subscribedSignalIds = currentUserId != null ?
                subscriptionRepository.findSignalIdsByUserId(currentUserId).stream().collect(Collectors.toSet()) : Set.of();

        return signals.stream()
                .map(s -> toSignalResponse(s, likedSignalIds, favoritedSignalIds, subscribedSignalIds))
                .collect(Collectors.toList());
    }

    // ========== 信号管理 ==========

    /**
     * 创建信号
     */
    @Override
    @Transactional
    public SignalResponse createSignal(Long userId, CreateSignalRequest request) {
        log.info(": userId={}, symbol={}", userId, request.getSymbol());

        // （7）
        LocalDateTime expiresAt = LocalDateTime.now().plus(7, ChronoUnit.DAYS);

        CommunitySignal signal = CommunitySignal.builder()
                .userId(userId)
                .strategyId(request.getStrategyId())
                .symbol(request.getSymbol().toUpperCase(Locale.ROOT))
                .signalType(CommunitySignal.SignalType.valueOf(request.getSignalType()))
                .reason(request.getReason())
                .targetPrice(request.getTargetPrice())
                .stopLoss(request.getStopLoss())
                .timeFrame(request.getTimeFrame())
                .confidence(request.getConfidence())
                .status(CommunitySignal.Status.ACTIVE)
                .resultStatus(CommunitySignal.ResultStatus.PENDING)
                .expiresAt(expiresAt)
                .tags(request.getTags())
                .build();

        CommunitySignal saved = signalRepository.save(signal);

        // 
        updateUserStats(userId);

        return toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }

    /**
     * 更新信号
     */
    @Override
    @Transactional
    public SignalResponse updateSignal(Long userId, Long signalId, UpdateSignalRequest request) {
        log.info(": userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = loadSignalOrThrow(signalId);

        assertOwner(signal.getUserId(), userId, "无权更新此信号");

        if (request.getReason() != null) {
            signal.setReason(request.getReason());
        }
        if (request.getTargetPrice() != null) {
            signal.setTargetPrice(request.getTargetPrice());
        }
        if (request.getStopLoss() != null) {
            signal.setStopLoss(request.getStopLoss());
        }
        if (request.getConfidence() != null) {
            signal.setConfidence(request.getConfidence());
        }
        if (request.getStatus() != null) {
            signal.setStatus(CommunitySignal.Status.valueOf(request.getStatus()));
        }
        if (request.getTags() != null) {
            signal.setTags(request.getTags());
        }

        CommunitySignal saved = signalRepository.save(signal);
        return toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }

    /**
     * 关闭信号
     */
    @Override
    @Transactional
    public SignalResponse closeSignal(Long userId, Long signalId, String resultStatus, BigDecimal resultProfit) {
        log.info(": userId={}, signalId={}, result={}", userId, signalId, resultStatus);

        CommunitySignal signal = loadSignalOrThrow(signalId);

        assertOwner(signal.getUserId(), userId, "无权关闭此信号");

        signal.setStatus(CommunitySignal.Status.CLOSED);
        signal.setResultStatus(CommunitySignal.ResultStatus.valueOf(resultStatus));
        signal.setResultProfit(resultProfit);

        CommunitySignal saved = signalRepository.save(signal);

        // 
        updateUserStats(userId);

        return toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }

    /**
     * 删除信号
     */
    @Override
    @Transactional
    public void deleteSignal(Long userId, Long signalId) {
        log.info(": userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = loadSignalOrThrow(signalId);

        assertOwner(signal.getUserId(), userId, "无权删除此信号");

        signalRepository.delete(signal);
    }

    // ========== 订阅管理 ==========

    /**
     * 订阅信号
     */
    @Override
    @Transactional
    public SignalSubscriptionResponse subscribeSignal(Long userId, Long signalId) {
        log.info(": userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = loadSignalOrThrow(signalId);

        // 
        if (subscriptionRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("已订阅此信号");
        }

        SignalSubscription subscription = SignalSubscription.builder()
                .signalId(signalId)
                .userId(userId)
                .notifyEnabled(true)
                .build();

        subscriptionRepository.save(subscription);
        signalRepository.incrementSubscribeCount(signalId);

        return toSubscriptionResponse(subscription, signal);
    }

    /**
     * 取消订阅信号
     */
    @Override
    @Transactional
    public void unsubscribeSignal(Long userId, Long signalId) {
        log.info(": userId={}, signalId={}", userId, signalId);

        if (!subscriptionRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("未订阅此信号");
        }

        subscriptionRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementSubscribeCount(signalId);
    }

    /**
     * 获取我的订阅
     */
    @Override
    public List<SignalSubscriptionResponse> getMySubscriptions(Long userId) {
        log.info(": userId={}", userId);

        List<SignalSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
        Map<Long, CommunitySignal> signalMap = signalRepository.findAllById(
                        subscriptions.stream().map(SignalSubscription::getSignalId).collect(Collectors.toList()))
                .stream().collect(Collectors.toMap(CommunitySignal::getId, Function.identity()));

        return subscriptions.stream()
                .map(s -> toSubscriptionResponse(s, signalMap.get(s.getSignalId())))
                .collect(Collectors.toList());
    }

    // ========== 点赞与收藏 ==========

    /**
     * 点赞信号
     */
    @Override
    @Transactional
    public void likeSignal(Long userId, Long signalId) {
        log.info(": userId={}, signalId={}", userId, signalId);

        if (likeRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("已点赞此信号");
        }

        SignalLike like = SignalLike.builder()
                .signalId(signalId)
                .userId(userId)
                .build();

        likeRepository.save(like);
        signalRepository.incrementLikeCount(signalId);
    }

    /**
     * 取消点赞信号
     */
    @Override
    @Transactional
    public void unlikeSignal(Long userId, Long signalId) {
        log.info(": userId={}, signalId={}", userId, signalId);

        if (!likeRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("未点赞此信号");
        }

        likeRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementLikeCount(signalId);
    }

    /**
     * 收藏信号
     */
    @Override
    @Transactional
    public void favoriteSignal(Long userId, Long signalId, String note) {
        log.info(": userId={}, signalId={}", userId, signalId);

        if (favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("已收藏此信号");
        }

        SignalFavorite favorite = SignalFavorite.builder()
                .signalId(signalId)
                .userId(userId)
                .note(note)
                .build();

        favoriteRepository.save(favorite);
        signalRepository.incrementFavoriteCount(signalId);
    }

    /**
     * 取消收藏信号
     */
    @Override
    @Transactional
    public void unfavoriteSignal(Long userId, Long signalId) {
        log.info(": userId={}, signalId={}", userId, signalId);

        if (!favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("未收藏此信号");
        }

        favoriteRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementFavoriteCount(signalId);
    }

    // ========== 评论管理 ==========

    /**
     * 获取评论列表
     */
    @Override
    public List<CommentResponse> getComments(Long signalId, int page, int size) {
        log.info(": signalId={}", signalId);

        Pageable pageable = PageRequest.of(page, size);
        Page<SignalComment> commentPage = commentRepository
                .findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(signalId, pageable);

        //  ID
        List<Long> parentIds = commentPage.getContent().stream()
                .map(SignalComment::getId)
                .collect(Collectors.toList());

        // 
        Map<Long, List<SignalComment>> repliesMap = commentRepository.findAllById(parentIds).stream()
                .collect(Collectors.toMap(
                        SignalComment::getId,
                        c -> commentRepository.findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(c.getId()),
                        (a, b) -> a
                ));

        return commentPage.getContent().stream()
                .map(c -> toCommentResponse(c, repliesMap.getOrDefault(c.getId(), List.of())))
                .collect(Collectors.toList());
    }

    /**
     * 创建评论
     */
    @Override
    @Transactional
    public CommentResponse createComment(Long userId, Long signalId, CreateCommentRequest request) {
        log.info(": userId={}, signalId={}", userId, signalId);

        loadSignalOrThrow(signalId);

        SignalComment comment = SignalComment.builder()
                .signalId(signalId)
                .userId(userId)
                .parentId(request.getParentId())
                .content(request.getContent())
                .build();

        SignalComment saved = commentRepository.save(comment);
        signalRepository.incrementCommentCount(signalId);

        return toCommentResponse(saved, List.of());
    }

    /**
     * 删除评论
     */
    @Override
    @Transactional
    public void deleteComment(Long userId, Long commentId) {
        log.info(": userId={}, commentId={}", userId, commentId);

        SignalComment comment = loadCommentOrThrow(commentId);

        assertOwner(comment.getUserId(), userId, "无权删除此评论");

        commentRepository.softDelete(commentId);
        signalRepository.decrementCommentCount(comment.getSignalId());
    }

    // ========== 用户统计 ==========

    /**
     * 获取用户统计
     */
    @Override
    public UserSignalStatsResponse getUserStats(Long userId) {
        UserSignalStats stats = statsRepository.findByUserId(userId)
                .orElseGet(() -> UserSignalStats.builder()
                        .userId(userId)
                        .totalSignals(0)
                        .winSignals(0)
                        .lossSignals(0)
                        .winRate(BigDecimal.ZERO)
                        .followerCount(0)
                        .reputationScore(0)
                        .build());

        User user = userRepository.findById(userId).orElse(null);

        return UserSignalStatsResponse.builder()
                .userId(userId)
                .username(user != null ? user.getUsername() : null)
                .avatarUrl(user != null ? user.getAvatarUrl() : null)
                .totalSignals(stats.getTotalSignals())
                .winSignals(stats.getWinSignals())
                .lossSignals(stats.getLossSignals())
                .winRate(stats.getWinRate())
                .avgProfit(stats.getAvgProfit())
                .followerCount(stats.getFollowerCount())
                .reputationScore(stats.getReputationScore())
                .build();
    }

    // ========== 私有方法 ==========

    private CommunitySignal loadSignalOrThrow(Long signalId) {
        Long nonNullSignalId = Objects.requireNonNull(signalId, "signalId must not be null");
        return requireFound(signalRepository.findById(nonNullSignalId),
                () -> new ResourceNotFoundException("信号不存在: " + signalId));
    }

    private SignalComment loadCommentOrThrow(Long commentId) {
        Long nonNullCommentId = Objects.requireNonNull(commentId, "commentId must not be null");
        return requireFound(commentRepository.findById(nonNullCommentId),
                () -> new ResourceNotFoundException("评论不存在: " + commentId));
    }

    private SignalResponse toSignalResponse(CommunitySignal signal,
                                           Set<Long> likedSignalIds,
                                           Set<Long> favoritedSignalIds,
                                           Set<Long> subscribedSignalIds) {
        User user = userRepository.findById(signal.getUserId()).orElse(null);

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
                .timeFrame(signal.getTimeFrame())
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

    private SignalSubscriptionResponse toSubscriptionResponse(SignalSubscription subscription, CommunitySignal signal) {
        User user = userRepository.findById(subscription.getUserId()).orElse(null);

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

    private CommentResponse toCommentResponse(SignalComment comment, List<SignalComment> replies) {
        User user = userRepository.findById(comment.getUserId()).orElse(null);

        List<CommentResponse> replyResponses = replies != null ?
                replies.stream().map(r -> toCommentResponse(r, List.of())).collect(Collectors.toList()) : List.of();

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

    private void updateUserStats(Long userId) {
        Optional<UserSignalStats> optionalStats = statsRepository.findByUserId(userId);

        if (optionalStats.isPresent()) {
            UserSignalStats stats = optionalStats.get();

            // 
            long totalSignals = signalRepository.countByUserId(userId);

            stats.setTotalSignals((int) totalSignals);
            stats.calculateWinRate();

            statsRepository.save(stats);
        } else {
            // 
            UserSignalStats newStats = UserSignalStats.builder()
                    .userId(userId)
                    .totalSignals(1)
                    .winSignals(0)
                    .lossSignals(0)
                    .winRate(BigDecimal.ZERO)
                    .followerCount(0)
                    .reputationScore(0)
                    .build();
            statsRepository.save(newStats);
        }
    }
}
