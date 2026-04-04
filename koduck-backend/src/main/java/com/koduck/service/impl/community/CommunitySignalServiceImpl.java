package com.koduck.service.impl.community;

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

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.CreateCommentRequest;
import com.koduck.dto.community.CreateSignalRequest;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.dto.community.SignalSubscriptionResponse;
import com.koduck.dto.community.UpdateSignalRequest;
import com.koduck.dto.community.UserSignalStatsResponse;
import com.koduck.entity.community.CommunitySignal;
import com.koduck.entity.community.SignalComment;
import com.koduck.entity.community.SignalFavorite;
import com.koduck.entity.community.SignalLike;
import com.koduck.entity.community.SignalSubscription;
import com.koduck.entity.auth.User;
import com.koduck.entity.community.UserSignalStats;
import com.koduck.exception.BusinessException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.community.CommunitySignalRepository;
import com.koduck.repository.community.SignalCommentRepository;
import com.koduck.repository.community.SignalFavoriteRepository;
import com.koduck.repository.community.SignalLikeRepository;
import com.koduck.repository.community.SignalSubscriptionRepository;
import com.koduck.repository.auth.UserRepository;
import com.koduck.repository.community.UserSignalStatsRepository;
import com.koduck.service.CommunitySignalService;
import com.koduck.service.support.CommunitySignalResponseAssembler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import static com.koduck.util.ServiceValidationUtils.assertOwner;
import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Community signal service implementation.
 *
 * @author GitHub Copilot
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CommunitySignalServiceImpl implements CommunitySignalService {

    /** Log template for user ID and signal ID. */
    private static final String USER_ID_SIGNAL_ID_LOG_TEMPLATE = ": userId={}, signalId={}";

    /** Default page size for featured signals. */
    private static final int DEFAULT_FEATURED_PAGE_SIZE = 5;

    /** Default signal expiry days. */
    private static final int DEFAULT_SIGNAL_EXPIRY_DAYS = 7;

    /** Empty interaction flags. */
    private static final InteractionFlags EMPTY_INTERACTION_FLAGS = new InteractionFlags(
        Set.of(),
        Set.of(),
        Set.of()
    );

    /** Repository for community signals. */
    private final CommunitySignalRepository signalRepository;

    /** Repository for subscriptions. */
    private final SignalSubscriptionRepository subscriptionRepository;

    /** Repository for likes. */
    private final SignalLikeRepository likeRepository;

    /** Repository for favorites. */
    private final SignalFavoriteRepository favoriteRepository;

    /** Repository for comments. */
    private final SignalCommentRepository commentRepository;

    /** Repository for user stats. */
    private final UserSignalStatsRepository statsRepository;

    /** Repository for users. */
    private final UserRepository userRepository;

    /** Assembler for responses. */
    private final CommunitySignalResponseAssembler responseAssembler;

    // ========== Signal Query ==========
    /**
     * Get signal list.
     */
    @Override
    public SignalListResponse getSignals(Long currentUserId, String sort, String symbol,
                                         String type, int page, int size) {
        log.info(": sort={}, symbol={}, type={}", sort, symbol, type);
        Pageable pageable = PageRequest.of(page, size);
        Page<CommunitySignal> signalPage;
        // Apply query strategy based on sorting/filtering parameters.
        if ("hot".equalsIgnoreCase(sort)) {
            signalPage = signalRepository.findHotSignals(CommunitySignal.Status.ACTIVE, pageable);
        }
        else if (symbol != null && !symbol.isEmpty()) {
            signalPage = signalRepository.findBySymbolContainingAndStatus(
                symbol.toUpperCase(Locale.ROOT), CommunitySignal.Status.ACTIVE, pageable);
        }
        else if (type != null && !type.isEmpty()) {
            signalPage = signalRepository.findBySignalTypeAndStatus(
                CommunitySignal.SignalType.valueOf(type.toUpperCase(Locale.ROOT)),
                CommunitySignal.Status.ACTIVE, pageable);
        }
        else {
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
     * Get featured signal list.
     */
    @Override
    public List<SignalResponse> getFeaturedSignals(Long currentUserId) {
        Pageable pageable = PageRequest.of(0, DEFAULT_FEATURED_PAGE_SIZE);
        Page<CommunitySignal> signals = signalRepository.findByIsFeaturedTrueAndStatus(
            pageable, CommunitySignal.Status.ACTIVE);
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
     * Get signal detail.
     */
    @Override
    @Transactional
    public SignalResponse getSignal(Long currentUserId, Long signalId) {
        log.info(": signalId={}", signalId);
        CommunitySignal signal = loadSignalOrThrow(signalId);
        // Increase view count after successful lookup.
        signalRepository.incrementViewCount(signalId);
        Set<Long> likedSignalIds = currentUserId != null
            && likeRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        Set<Long> favoritedSignalIds = currentUserId != null
            && favoriteRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        Set<Long> subscribedSignalIds = currentUserId != null
            && subscriptionRepository.existsBySignalIdAndUserId(signalId, currentUserId)
                ? Set.of(signalId) : Set.of();
        return responseAssembler.toSignalResponse(
            signal, likedSignalIds, favoritedSignalIds, subscribedSignalIds);
    }

    /**
     * Get user published signals.
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

    // ========== Signal Management ==========
    /**
     * Create signal.
     */
    @Override
    @Transactional
    public SignalResponse createSignal(Long userId, CreateSignalRequest request) {
        log.info(": userId={}, symbol={}", userId, request.getSymbol());
        // Default signal expiry window is 7 days.
        LocalDateTime expiresAt = LocalDateTime.now().plus(DEFAULT_SIGNAL_EXPIRY_DAYS,
            ChronoUnit.DAYS);
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
        CommunitySignal saved = signalRepository.save(
            Objects.requireNonNull(signal, "signal must not be null"));
        // Update user stats
        updateUserStats(userId);
        return responseAssembler.toSignalResponse(saved, Set.of(), Set.of(), Set.of());
    }

    /**
     * Update signal.
     */
    @Override
    @Transactional
    public SignalResponse updateSignal(Long userId, Long signalId,
                                       UpdateSignalRequest request) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        CommunitySignal signal = loadSignalOrThrow(signalId);
        assertOwner(signal.getUserId(), userId, "Not authorized to update this signal");
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
     * Close signal.
     */
    @Override
    @Transactional
    public SignalResponse closeSignal(Long userId, Long signalId, String resultStatus,
                                      BigDecimal resultProfit) {
        log.info(": userId={}, signalId={}, result={}", userId, signalId, resultStatus);
        CommunitySignal signal = loadSignalOrThrow(signalId);
        assertOwner(signal.getUserId(), userId, "Not authorized to close this signal");
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
     * Delete signal.
     */
    @Override
    @Transactional
    public void deleteSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        CommunitySignal signal = loadSignalOrThrow(signalId);
        assertOwner(signal.getUserId(), userId, "Not authorized to delete this signal");
        signalRepository.delete(signal);
    }

    // ========== Subscription Management ==========
    /**
     * Subscribe to signal.
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
        subscriptionRepository.save(
            Objects.requireNonNull(subscription, "subscription must not be null"));
        signalRepository.incrementSubscribeCount(signalId);
        return responseAssembler.toSubscriptionResponse(subscription, signal);
    }

    /**
     * Unsubscribe from signal.
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
     * Get my subscriptions.
     */
    @Override
    public List<SignalSubscriptionResponse> getMySubscriptions(Long userId) {
        log.info(": userId={}", userId);
        List<SignalSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
        List<Long> signalIds = subscriptions.stream()
            .map(SignalSubscription::getSignalId)
            .toList();
        Map<Long, CommunitySignal> signalMap = signalRepository.findAllById(
                Objects.requireNonNull(signalIds, "signalIds must not be null"))
                .stream()
                .collect(Collectors.toMap(CommunitySignal::getId, Function.identity()));
        return subscriptions.stream()
                .map(s -> responseAssembler.toSubscriptionResponse(
                    s, signalMap.get(s.getSignalId())))
                .toList();
    }

    // ========== Likes and Favorites ==========
    /**
     * Like signal.
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
     * Unlike signal.
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
     * Favorite signal.
     */
    @Override
    @Transactional
    public void favoriteSignal(Long userId, Long signalId, String note) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.DUPLICATE_ERROR, "Already favorited");
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
     * Unfavorite signal.
     */
    @Override
    @Transactional
    public void unfavoriteSignal(Long userId, Long signalId) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        if (!favoriteRepository.existsBySignalIdAndUserId(signalId, userId)) {
            throw new BusinessException(ErrorCode.BUSINESS_ERROR, "Not favorited");
        }
        favoriteRepository.deleteBySignalIdAndUserId(signalId, userId);
        signalRepository.decrementFavoriteCount(signalId);
    }

    // ========== Comment Management ==========
    /**
     * Get comment list.
     */
    @Override
    public List<CommentResponse> getComments(Long signalId, int page, int size) {
        log.info(": signalId={}", signalId);
        Pageable pageable = PageRequest.of(page, size);
        Page<SignalComment> commentPage = commentRepository
                .findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(
                    signalId, pageable);
        // Collect parent comment IDs for reply lookup.
        List<Long> parentIds = commentPage.getContent().stream()
                .map(SignalComment::getId)
                .toList();
        // Group child replies by parent comment ID.
        Map<Long, List<SignalComment>> repliesMap = commentRepository.findAllById(
                Objects.requireNonNull(parentIds, "parentIds must not be null"))
                .stream()
                .collect(Collectors.toMap(
                    SignalComment::getId,
                    c -> commentRepository.findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(
                        c.getId()),
                    (a, b) -> a
                ));
        return commentPage.getContent().stream()
            .map(c -> responseAssembler.toCommentResponse(
                c, repliesMap.getOrDefault(c.getId(), List.of())))
            .toList();
    }

    /**
     * Create comment.
     */
    @Override
    @Transactional
    public CommentResponse createComment(Long userId, Long signalId,
                                         CreateCommentRequest request) {
        log.info(USER_ID_SIGNAL_ID_LOG_TEMPLATE, userId, signalId);
        loadSignalOrThrow(signalId);
        SignalComment comment = SignalComment.builder()
                .signalId(signalId)
                .userId(userId)
                .parentId(request.getParentId())
                .content(request.getContent())
                .build();
        SignalComment saved = commentRepository.save(
            Objects.requireNonNull(comment, "comment must not be null"));
        signalRepository.incrementCommentCount(signalId);
        return responseAssembler.toCommentResponse(saved, List.of());
    }

    /**
     * Delete comment.
     */
    @Override
    @Transactional
    public void deleteComment(Long userId, Long commentId) {
        log.info(": userId={}, commentId={}", userId, commentId);
        SignalComment comment = loadCommentOrThrow(commentId);
        assertOwner(comment.getUserId(), userId, "Not authorized to delete this comment");
        commentRepository.softDelete(commentId);
        signalRepository.decrementCommentCount(comment.getSignalId());
    }

    // ========== User Statistics ==========
    /**
     * Get user stats.
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
        User user = userRepository.findById(
            Objects.requireNonNull(userId, "userId must not be null")).orElse(null);
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

    // ========== Private Methods ==========
    /**
     * Load interaction flags for current user.
     *
     * @param currentUserId the current user ID
     * @return the interaction flags
     */
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

    /**
     * Load signal or throw exception if not found.
     *
     * @param signalId the signal ID
     * @return the community signal
     */
    private CommunitySignal loadSignalOrThrow(Long signalId) {
        Long nonNullSignalId = Objects.requireNonNull(signalId, "signalId must not be null");
        return requireFound(signalRepository.findById(nonNullSignalId),
            () -> new ResourceNotFoundException("Signal not found: " + signalId));
    }

    /**
     * Load comment or throw exception if not found.
     *
     * @param commentId the comment ID
     * @return the signal comment
     */
    private SignalComment loadCommentOrThrow(Long commentId) {
        Long nonNullCommentId = Objects.requireNonNull(commentId, "commentId must not be null");
        return requireFound(commentRepository.findById(nonNullCommentId),
            () -> new ResourceNotFoundException("Comment not found: " + commentId));
    }

    /**
     * Update user stats.
     *
     * @param userId the user ID
     */
    private void updateUserStats(Long userId) {
        Optional<UserSignalStats> optionalStats = statsRepository.findByUserId(userId);
        if (optionalStats.isPresent()) {
            UserSignalStats stats = optionalStats.get();
            // Recalculate aggregate stats from latest signal data.
            long totalSignals = signalRepository.countByUserId(userId);
            stats.setTotalSignals((int) totalSignals);
            stats.calculateWinRate();
            statsRepository.save(stats);
        }
        else {
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

    /**
     * Record for interaction flags.
     *
     * @param likedSignalIds the liked signal IDs
     * @param favoritedSignalIds the favorited signal IDs
     * @param subscribedSignalIds the subscribed signal IDs
     */
    private record InteractionFlags(
        Set<Long> likedSignalIds,
        Set<Long> favoritedSignalIds,
        Set<Long> subscribedSignalIds
    ) {
    }
}
