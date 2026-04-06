package com.koduck.strategy.api;

import com.koduck.strategy.dto.BacktestResultDto;
import com.koduck.strategy.dto.BacktestSummaryDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Optional;

/**
 * 回测查询服务接口。
 *
 * <p>提供回测结果的查询操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface BacktestQueryService {

    /**
     * 根据ID获取回测结果详情。
     *
     * @param backtestId 回测ID
     * @return 回测结果详情，未找到时返回 empty
     */
    Optional<BacktestResultDto> getBacktestResult(@NotNull @Positive Long backtestId);

    /**
     * 获取策略的所有回测记录。
     *
     * @param strategyId 策略ID
     * @return 回测摘要列表
     */
    List<BacktestSummaryDto> getStrategyBacktests(@NotNull @Positive Long strategyId);

    /**
     * 获取用户的所有回测记录。
     *
     * @param userId 用户ID
     * @param page 页码（从1开始）
     * @param pageSize 每页大小
     * @return 回测摘要列表
     */
    List<BacktestSummaryDto> getUserBacktests(
            @NotNull @Positive Long userId,
            @Positive int page,
            @Positive int pageSize);

    /**
     * 获取策略的最佳回测结果（按收益率）。
     *
     * @param strategyId 策略ID
     * @return 最佳回测结果
     */
    Optional<BacktestSummaryDto> getBestBacktest(@NotNull @Positive Long strategyId);

    /**
     * 获取策略的最新回测结果。
     *
     * @param strategyId 策略ID
     * @return 最新回测结果
     */
    Optional<BacktestSummaryDto> getLatestBacktest(@NotNull @Positive Long strategyId);
}
