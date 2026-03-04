package com.koduck.service;

import com.koduck.dto.community.*;
import com.koduck.entity.*;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.*;
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
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 社区信号服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CommunitySignalService {

    private final CommunitySignalRepository signalRepository;
    private final SignalSubscriptionRepository subscriptionRepository;
    private final SignalLikeRepository likeRepository;
    private final SignalFavoriteRepository favoriteRepository;
    private final SignalCommentRepository commentRepository;
    private final UserSignalStatsRepository statsRepository;
    private final UserRepository userRepository;

    // ========== 信号列表与查询 ==========

    /**
     * 获取信号列表
     */
    public SignalListResponse getSignals(Long currentUserId, String sort, String symbol, String type, int page, int size) {
        log.info("获取信号列表: sort={}, symbol={}, type={}", sort, symbol, type);

        Pageable pageable = PageRequest.of(page, size);
        Page<CommunitySignal> signalPage;

        // 根据排序方式查询
        if ("hot".equalsIgnoreCase(sort)) {
            signalPage = signalRepository.findHotSignals(CommunitySignal.Status.ACTIVE, pageable);
        } else if (symbol != null && !symbol.isEmpty()) {
            signalPage = signalRepository.findBySymbolContainingAndStatus(symbol.toUpperCase(), CommunitySignal.Status.ACTIVE, pageable);
        } else if (type != null && !type.isEmpty()) {
            signalPage = signalRepository.findBySignalTypeAndStatus(
                    CommunitySignal.SignalType.valueOf(type.toUpperCase()), CommunitySignal.Status.ACTIVE, pageable);
        } else {
            signalPage = signalRepository.findByStatus(CommunitySignal.Status.ACTIVE, 
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        }

        // 获取用户互动状态
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
     * 获取推荐信号
     */
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
    @Transactional
    public SignalResponse getSignal(Long currentUserId, Long signalId) {
        log.info("获取信号详情: signalId={}", signalId);

        CommunitySignal signal = signalRepository.findById(signalId)
                .orElseThrow(() -> new ResourceNotFoundException("信号不存在: " + signalId));

        // 增加浏览数
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
     * 获取用户的信号列表
     */
    public List<SignalResponse> getUserSignals(Long currentUserId, Long userId) {
        log.info("获取用户信号列表: userId={}", userId);

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

    // ========== 信号发布与更新 ==========

    /**
     * 发布信号
     */
    @Transactional
    public SignalResponse createSignal(Long userId, CreateSignalRequest request) {
        log.info("发布信号: userId={}, symbol={}", userId, request.getSymbol());

        // 设置默认过期时间（7天）
        LocalDateTime expiresAt = LocalDateTime.now().plus(7, ChronoUnit.DAYS);

        CommunitySignal signal = CommunitySignal.builder()
                .userId(userId)
                .strategyId(request.getStrategyId())
                .symbol(request.getSymbol().toUpperCase())
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

        // 更新用户统计
        updateUserStats(userId);

        return toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }

    /**
     * 更新信号
     */
    @Transactional
    public SignalResponse updateSignal(Long userId, Long signalId, UpdateSignalRequest request) {
        log.info("更新信号: userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = signalRepository.findById(signalId)
                .orElseThrow(() -> new ResourceNotFoundException("信号不存在: " + signalId));

        // 验证权限
        if (!signal.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权更新此信号");
        }

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
    @Transactional
    public SignalResponse closeSignal(Long userId, Long signalId, String resultStatus, BigDecimal resultProfit) {
        log.info("关闭信号: userId={}, signalId={}, result={}", userId, signalId, resultStatus);

        CommunitySignal signal = signalRepository.findById(signalId)
                .orElseThrow(() -> new ResourceNotFoundException("信号不存在: " + signalId));

        // 验证权限
        if (!signal.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权关闭此信号");
        }

        signal.setStatus(CommunitySignal.Status.CLOSED);
        signal.setResultStatus(CommunitySignal.ResultStatus.valueOf(resultStatus));
        signal.setResultProfit(resultProfit);

        CommunitySignal saved = signalRepository.save(signal);

        // 更新用户统计
        updateUserStats(userId);

        return toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }

    /**
     * 删除信号
     */
    @Transactional
    public void deleteSignal(Long userId, Long signalId) {
        log.info("删除信号: userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = signalRepository.findById(signalId)
                .orElseThrow(() -> new ResourceNotFoundException("信号不存在: " + signalId));

        // 验证权限
        if (!signal.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权删除此信号");
        }

        signalRepository.delete(signal);
    }

    // ========== 订阅功能 ==========

    /**
     * 订阅信号
     */
    @Transactional
    public SignalSubscriptionResponse subscribeSignal(Long userId, Long signalId) {
        log.info("订阅信号: userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = signalRepository.findById(signalId)
                .orElseThrow(() -> new ResourceNotFoundException("信号不存在: " + signalId));

        // 检查是否已订阅
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
     * 取消订阅
     */
    @Transactional
    public void unsubscribeSignal(Long userId, Long signalId) {
        log.info("取消订阅: userId={}, signalId={}", userId, signalId);

        if (!subscriptionRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("未订阅此信号");
        }

        subscriptionRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementSubscribeCount(signalId);
    }

    /**
     * 获取我的订阅列表
     */
    public List<SignalSubscriptionResponse> getMySubscriptions(Long userId) {
        log.info("获取订阅列表: userId={}", userId);

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
    @Transactional
    public void likeSignal(Long userId, Long signalId) {
        log.info("点赞信号: userId={}, signalId={}", userId, signalId);

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
     * 取消点赞
     */
    @Transactional
    public void unlikeSignal(Long userId, Long signalId) {
        log.info("取消点赞: userId={}, signalId={}", userId, signalId);

        if (!likeRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("未点赞此信号");
        }

        likeRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementLikeCount(signalId);
    }

    /**
     * 收藏信号
     */
    @Transactional
    public void favoriteSignal(Long userId, Long signalId, String note) {
        log.info("收藏信号: userId={}, signalId={}", userId, signalId);

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
     * 取消收藏
     */
    @Transactional
    public void unfavoriteSignal(Long userId, Long signalId) {
        log.info("取消收藏: userId={}, signalId={}", userId, signalId);

        if (!favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new IllegalArgumentException("未收藏此信号");
        }

        favoriteRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementFavoriteCount(signalId);
    }

    // ========== 评论功能 ==========

    /**
     * 获取评论列表
     */
    public List<CommentResponse> getComments(Long signalId, int page, int size) {
        log.info("获取评论列表: signalId={}", signalId);

        Pageable pageable = PageRequest.of(page, size);
        Page<SignalComment> commentPage = commentRepository
                .findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(signalId, pageable);

        // 获取所有父评论 ID
        List<Long> parentIds = commentPage.getContent().stream()
                .map(SignalComment::getId)
                .collect(Collectors.toList());

        // 获取回复
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
     * 发布评论
     */
    @Transactional
    public CommentResponse createComment(Long userId, Long signalId, CreateCommentRequest request) {
        log.info("发布评论: userId={}, signalId={}", userId, signalId);

        CommunitySignal signal = signalRepository.findById(signalId)
                .orElseThrow(() -> new ResourceNotFoundException("信号不存在: " + signalId));

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
    @Transactional
    public void deleteComment(Long userId, Long commentId) {
        log.info("删除评论: userId={}, commentId={}", userId, commentId);

        SignalComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("评论不存在: " + commentId));

        // 验证权限
        if (!comment.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权删除此评论");
        }

        commentRepository.softDelete(commentId);
        signalRepository.decrementCommentCount(comment.getSignalId());
    }

    // ========== 用户统计 ==========

    /**
     * 获取用户信号统计
     */
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

    // ========== 辅助方法 ==========

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

            // 重新计算统计
            long totalSignals = signalRepository.countByUserId(userId);
            long activeSignals = signalRepository.countByUserIdAndStatus(userId, CommunitySignal.Status.ACTIVE);

            stats.setTotalSignals((int) totalSignals);
            stats.calculateWinRate();

            statsRepository.save(stats);
        } else {
            // 创建新的统计记录
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
