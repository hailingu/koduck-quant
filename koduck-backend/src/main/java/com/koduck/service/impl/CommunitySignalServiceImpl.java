package com.koduck.service.impl;

import com.koduck.dto.community.*;
import com.koduck.entity.*;
import com.koduck.exception.BusinessException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.*;
import com.koduck.service.CommunitySignalService;
import com.koduck.service.support.CommunitySignalResponseAssembler;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.koduck.util.ServiceValidationUtils.assertOwner;
import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * 社区信号服务实现
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CommunitySignalServiceImpl implements CommunitySignalService {

    private static final String USER_ID_SIGNAL_ID_LOG_TEMPLATE = ": userId={}, signalId={}";
    private static final InteractionFlags EMPTY_INTERACTION_FLAGS = new InteractionFlags(
        Set.of(),
        Set.of(),
        Set.of()
    );

    private final CommunitySignalRepository signalRepository;

    private final SignalSubscriptionRepository subscriptionRepository;

    private final SignalLikeRepository likeRepository;

    private final SignalFavoriteRepository favoriteRepository;

    private final SignalCommentRepository commentRepository;

    private final UserSignalStatsRepository statsRepository;

    private final UserRepository userRepository;

    private final CommunitySignalResponseAssembler responseAssembler;

    // ========== 信号查询 ==========
    /**
     * 获取信号列表
     */
    @Override
    public SignalListResponse getSignals(Long currentUserId, String sort, String symbol, String type, int page, int size) {
        log.info(": sort={}, symbol={}, type={}", sort, symbol, type);
        Pageable pageable = PageRequest.of(page, size);
        Page<CommunitySignal> signalPage;
        // Apply query strategy based on sorting/filtering parameters.
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
        // Resolve current user's interaction flags for each signal item.
        InteractionFlags interactionFlags = loadInteractionFlags(currentUserId);
        List<SignalResponse> items = signalPage.getContent().stream()
            .map(s -> responseAssembler.toSignalResponse(
                s,
                interactionFlags.likedSignalIds(),
                interactionFlags.favoritedSignalIds(),
                interactionFlags.subscribedSignalIds()))
            .toList();
        return SignalListResponse.builder()
                .items(items)
                .total(signalPage.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(signalPage.getTotalPages())
                .build();
    }
    /**
     * 获取精选信号列表。
     */
    @Override
    public List<SignalResponse> getFeaturedSignals(Long currentUserId) {
        Pageable pageable = PageRequest.of(0, 5);
        Page<CommunitySignal> signals = signalRepository.findByIsFeaturedTrueAndStatus(pageable, CommunitySignal.Status.ACTIVE);
        InteractionFlags interactionFlags = loadInteractionFlags(currentUserId);
        return signals.getContent().stream()
            .map(s -> responseAssembler.toSignalResponse(
                s,
                interactionFlags.likedSignalIds(),
                interactionFlags.favoritedSignalIds(),
                interactionFlags.subscribedSignalIds()))
            .toList();
    }
    /**
     * 获取信号详情
     */
    @Override
    @Transactional
    public SignalResponse getSignal(Long currentUserId, Long signalId) {
        log.info(": signalId={}", signalId);
        CommunitySignal signal = loadSignalOrThrow(signalId);
        // Increase view count after successful lookup.
        signalRepository.incrementViewCount(signalId);
        Set<Long> likedSignalIds = currentUserId != null && likeRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        Set<Long> favoritedSignalIds = currentUserId != null && favoriteRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        Set<Long> subscribedSignalIds = currentUserId != null && subscriptionRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        return responseAssembler.toSignalResponse(signal, likedSignalIds, favoritedSignalIds, subscribedSignalIds);
    }
    /**
     * 获取用户发布的信号
     */
    @Override
    public List<SignalResponse> getUserSignals(Long currentUserId, Long userId) {
        log.info(": userId={}", userId);
        List<CommunitySignal> signals = signalRepository.findByUserIdOrderByCreatedAtDesc(userId);
        InteractionFlags interactionFlags = loadInteractionFlags(currentUserId);
        return signals.stream()
            .map(s -> responseAssembler.toSignalResponse(
                s,
                interactionFlags.likedSignalIds(),
                interactionFlags.favoritedSignalIds(),
                interactionFlags.subscribedSignalIds()))
            .toList();
    }
    // ========== 信号管理 ==========
    /**
     * 创建信号
     */
    @Override
    @Transactional
    public SignalResponse createSignal(Long userId, CreateSignalRequest request) {
        log.info(": userId={}, symbol={}", userId, request.getSymbol());
        // Default signal expiry window is 7 days.
        LocalDateTime expiresAt = LocalDateTime.now().plus(7, ChronoUnit.DAYS);
        CommunitySignal signal = CommunitySignal.builder()
                .userId(userId)
                .strategyId(request.getStrategyId())
                .symbol(request.getSymbol().toUpperCase(Locale.ROOT))
                .signalType(CommunitySignal.SignalType.valueOf(request.getSignalType()))
                .reason(request.getReason())
                .targetPrice(request.getTargetPrice())
                .stopLoss(request.getStopLoss())
                .timeFrame(request.getSignalTimeFrame())
                .confidence(request.getConfidence())
                .status(CommunitySignal.Status.ACTIVE)
                .resultStatus(CommunitySignal.ResultStatus.PENDING)
                .expiresAt(expiresAt)
                .tags(request.getTags())
                .build();
        CommunitySignal saved = signalRepository.save(Objects.requireNonNull(signal, "signal must not be null"));
        // 
        updateUserStats(userId);
        return responseAssembler.toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }
    /**
     * 更新信号
     */
    @Override
    @Transactional
    public SignalResponse updateSignal(Long userId, Long signalId, UpdateSignalRequest request) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
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
        return responseAssembler.toSignalResponse(saved, Set.of(), Set.of(), Set.of());
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
        signalRepository.save(signal);
        CommunitySignal saved = signal;
        // Refresh publisher statistics after closing a signal.
        updateUserStats(userId);
        return responseAssembler.toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }
    /**
     * 删除信号
     */
    @Override
    @Transactional
    public void deleteSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
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
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        CommunitySignal signal = loadSignalOrThrow(signalId);
        // Prevent duplicate subscriptions.
        if (subscriptionRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.SIGNAL_ALREADY_SUBSCRIBED);
        }
        SignalSubscription subscription = SignalSubscription.builder()
                .signalId(signalId)
                .userId(userId)
                .notifyEnabled(true)
                .build();
        subscriptionRepository.save(Objects.requireNonNull(subscription, "subscription must not be null"));
        signalRepository.incrementSubscribeCount(signalId);
        return responseAssembler.toSubscriptionResponse(subscription, signal);
    }
    /**
     * 取消订阅信号
     */
    @Override
    @Transactional
    public void unsubscribeSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (!subscriptionRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.SIGNAL_NOT_SUBSCRIBED);
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
        List<Long> signalIds = subscriptions.stream().map(SignalSubscription::getSignalId).toList();
        Map<Long, CommunitySignal> signalMap = signalRepository.findAllById(
                Objects.requireNonNull(signalIds, "signalIds must not be null"))
                .stream().collect(Collectors.toMap(CommunitySignal::getId, Function.identity()));
        return subscriptions.stream()
                .map(s -> responseAssembler.toSubscriptionResponse(s, signalMap.get(s.getSignalId())))
                .toList();
    }
    // ========== 点赞与收藏 ==========
    /**
     * 点赞信号
     */
    @Override
    @Transactional
    public void likeSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (likeRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.SIGNAL_ALREADY_LIKED);
        }
        SignalLike like = SignalLike.builder()
                .signalId(signalId)
                .userId(userId)
                .build();
        likeRepository.save(Objects.requireNonNull(like, "like must not be null"));
        signalRepository.incrementLikeCount(signalId);
    }
    /**
     * 取消点赞信号
     */
    @Override
    @Transactional
    public void unlikeSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (!likeRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.SIGNAL_NOT_LIKED);
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
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.DUPLICATE_ERROR, "已收藏此信号");
        }
        SignalFavorite favorite = SignalFavorite.builder()
                .signalId(signalId)
                .userId(userId)
                .note(note)
                .build();
        favoriteRepository.save(Objects.requireNonNull(favorite, "favorite must not be null"));
        signalRepository.incrementFavoriteCount(signalId);
    }
    /**
     * 取消收藏信号
     */
    @Override
    @Transactional
    public void unfavoriteSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (!favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "未收藏此信号");
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
        // Collect parent comment IDs for reply lookup.
        List<Long> parentIds = commentPage.getContent().stream()
                .map(SignalComment::getId)
                .toList();
        // Group child replies by parent comment ID.
        Map<Long, List<SignalComment>> repliesMap = commentRepository.findAllById(
                Objects.requireNonNull(parentIds, "parentIds must not be null")).stream()
                .collect(Collectors.toMap(
                        SignalComment::getId,
                        c -> commentRepository.findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(c.getId()),
                (a, b) -> a
            ));
        return commentPage.getContent().stream()
            .map(c -> responseAssembler.toCommentResponse(c, repliesMap.getOrDefault(c.getId(), List.of())))
            .toList();
    }
    /**
     * 创建评论
     */
    @Override
    @Transactional
    public CommentResponse createComment(Long userId, Long signalId, CreateCommentRequest request) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        loadSignalOrThrow(signalId);
        SignalComment comment = SignalComment.builder()
                .signalId(signalId)
                .userId(userId)
                .parentId(request.getParentId())
                .content(request.getContent())
                .build();
        SignalComment saved = commentRepository.save(Objects.requireNonNull(comment, "comment must not be null"));
        signalRepository.incrementCommentCount(signalId);
        return responseAssembler.toCommentResponse(saved, List.of());
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
            .orElseGet(() -> {
                UserSignalStats newStats = new UserSignalStats();
                newStats.setUserId(userId);
                newStats.setTotalSignals(0);
                newStats.setWinSignals(0);
                newStats.setLossSignals(0);
                newStats.setWinRate(BigDecimal.ZERO);
                newStats.setFollowerCount(0);
                newStats.setReputationScore(0);
                return newStats;
            });
        User user = userRepository.findById(Objects.requireNonNull(userId, "userId must not be null")).orElse(null);
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
    private InteractionFlags loadInteractionFlags(Long currentUserId) {
        if (currentUserId == null) {
            return EMPTY_INTERACTION_FLAGS;
        }
        Set<Long> likedSignalIds = likeRepository.findSignalIdsByUserId(currentUserId)
            .stream()
            .collect(Collectors.toSet());
        Set<Long> favoritedSignalIds = favoriteRepository.findSignalIdsByUserId(currentUserId)
            .stream()
            .collect(Collectors.toSet());
        Set<Long> subscribedSignalIds = subscriptionRepository.findSignalIdsByUserId(currentUserId)
            .stream()
            .collect(Collectors.toSet());
        return new InteractionFlags(likedSignalIds, favoritedSignalIds, subscribedSignalIds);
    }

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
    private void updateUserStats(Long userId) {
        Optional<UserSignalStats> optionalStats = statsRepository.findByUserId(userId);
        if (optionalStats.isPresent()) {
            UserSignalStats stats = optionalStats.get();
            // Recalculate aggregate stats from latest signal data.
            long totalSignals = signalRepository.countByUserId(userId);
            stats.setTotalSignals((int) totalSignals);
            stats.calculateWinRate();
            statsRepository.save(stats);
        } else {
            UserSignalStats newStats = new UserSignalStats();
            newStats.setUserId(userId);
            newStats.setTotalSignals(1);
            newStats.setWinSignals(0);
            newStats.setLossSignals(0);
            newStats.setWinRate(BigDecimal.ZERO);
            newStats.setFollowerCount(0);
            newStats.setReputationScore(0);
            statsRepository.save(newStats);
        }
    }

    private record InteractionFlags(
        Set<Long> likedSignalIds,
        Set<Long> favoritedSignalIds,
        Set<Long> subscribedSignalIds
    ) {
    }
}
