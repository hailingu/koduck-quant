package com.koduck.strategy.acl;

import com.koduck.strategy.vo.BacktestResultSummary;
import com.koduck.strategy.vo.StrategySnapshot;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Optional;

/**
 * 策略查询服务防腐层接口。
 *
 * <p>供其他领域模块（如 AI）查询策略和回测数据使用。</p>
 *
 * <p>此接口提供简化的、只读的策略数据访问，隔离领域模型差异。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 * @see com.koduck.strategy.api.StrategyQueryService
 */
public interface StrategyQueryService {

    /**
     * 获取策略快照。
     *
     * <p>用于 AI 分析等场景。</p>
     *
     * @param strategyId 策略ID
     * @return 策略快照，未找到时返回 {@link Optional#empty()}
     */
    Optional<StrategySnapshot> getSnapshot(@NotNull @Positive Long strategyId);

    /**
     * 获取用户的所有策略快照。
     *
     * @param userId 用户ID
     * @return 策略快照列表
     */
    List<StrategySnapshot> getUserSnapshots(@NotNull @Positive Long userId);

    /**
     * 获取策略的回测结果摘要列表。
     *
     * @param strategyId 策略ID
     * @return 回测结果摘要列表
     */
    List<BacktestResultSummary> getBacktestSummaries(@NotNull @Positive Long strategyId);

    /**
     * 获取回测结果摘要。
     *
     * @param backtestId 回测ID
     * @return 回测结果摘要
     */
    Optional<BacktestResultSummary> getBacktestSummary(@NotNull @Positive Long backtestId);

    /**
     * 获取用户的最佳回测结果（按夏普比率）。
     *
     * @param userId 用户ID
     * @return 最佳回测结果摘要
     */
    Optional<BacktestResultSummary> getUserBestBacktest(@NotNull @Positive Long userId);
}
