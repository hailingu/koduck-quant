package com.koduck.community.acl;

import com.koduck.community.vo.SignalSnapshot;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Optional;

/**
 * 社区查询服务防腐层接口。
 *
 * <p>供其他领域模块（如 AI、Portfolio）查询社区数据使用。</p>
 *
 * <p>此接口提供简化的、只读的社区数据访问，隔离领域模型差异。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface CommunityQueryService {

    /**
     * 获取信号快照。
     *
     * <p>用于 AI 分析等场景。</p>
     *
     * @param signalId 信号ID
     * @return 信号快照，未找到时返回 {@link Optional#empty()}
     */
    Optional<SignalSnapshot> getSignalSnapshot(@NotNull @Positive Long signalId);

    /**
     * 获取用户的所有信号快照。
     *
     * @param userId 用户ID
     * @return 信号快照列表
     */
    List<SignalSnapshot> getUserSignalSnapshots(@NotNull @Positive Long userId);

    /**
     * 获取投资组合相关的信号快照。
     *
     * @param portfolioId 投资组合ID
     * @return 信号快照列表
     */
    List<SignalSnapshot> getPortfolioSignalSnapshots(@NotNull @Positive Long portfolioId);

    /**
     * 获取热门信号快照。
     *
     * @param limit 数量限制
     * @return 信号快照列表
     */
    List<SignalSnapshot> getHotSignalSnapshots(@Positive int limit);

    /**
     * 获取信号的统计信息。
     *
     * @param signalId 信号ID
     * @return 信号统计信息
     */
    Optional<SignalStatistics> getSignalStatistics(@NotNull @Positive Long signalId);

    /**
     * 获取用户的信号统计信息。
     *
     * @param userId 用户ID
     * @return 用户统计信息
     */
    UserStatistics getUserStatistics(@NotNull @Positive Long userId);

    /**
     * 信号统计信息。
     */
    record SignalStatistics(
            Long signalId,
            Integer viewCount,
            Integer likeCount,
            Integer commentCount,
            Double engagementRate
    ) {}

    /**
     * 用户统计信息。
     */
    record UserStatistics(
            Long userId,
            Integer totalSignals,
            Integer totalLikesReceived,
            Integer totalCommentsReceived,
            Integer followersCount
    ) {}
}
