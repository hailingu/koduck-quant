package com.koduck.community.api;

import com.koduck.community.dto.SignalDetailDto;
import com.koduck.community.dto.SignalDto;
import com.koduck.community.dto.SignalSummaryDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Optional;

/**
 * 信号查询服务接口。
 *
 * <p>提供信号的查询操作，不包含修改操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface SignalQueryService {

    /**
     * 根据ID获取信号详情。
     *
     * @param signalId 信号ID
     * @return 信号详情，未找到时返回 empty
     */
    Optional<SignalDetailDto> getSignalDetail(@NotNull @Positive Long signalId);

    /**
     * 根据ID获取信号基本信息。
     *
     * @param signalId 信号ID
     * @return 信号信息，未找到时返回 empty
     */
    Optional<SignalDto> getSignal(@NotNull @Positive Long signalId);

    /**
     * 获取所有活跃信号（分页）。
     *
     * @param page 页码（从1开始）
     * @param pageSize 每页大小
     * @return 信号摘要列表
     */
    List<SignalSummaryDto> getActiveSignals(@Positive int page, @Positive int pageSize);

    /**
     * 获取用户的所有信号。
     *
     * @param userId 用户ID
     * @param page 页码
     * @param pageSize 每页大小
     * @return 信号摘要列表
     */
    List<SignalSummaryDto> getUserSignals(@NotNull @Positive Long userId,
                                          @Positive int page,
                                          @Positive int pageSize);

    /**
     * 获取投资组合相关的信号。
     *
     * @param portfolioId 投资组合ID
     * @param page 页码
     * @param pageSize 每页大小
     * @return 信号摘要列表
     */
    List<SignalSummaryDto> getPortfolioSignals(@NotNull @Positive Long portfolioId,
                                               @Positive int page,
                                               @Positive int pageSize);

    /**
     * 搜索信号。
     *
     * @param keyword 关键词
     * @param page 页码
     * @param pageSize 每页大小
     * @return 信号摘要列表
     */
    List<SignalSummaryDto> searchSignals(String keyword,
                                         @Positive int page,
                                         @Positive int pageSize);

    /**
     * 获取热门信号。
     *
     * @param limit 数量限制
     * @return 信号摘要列表
     */
    List<SignalSummaryDto> getHotSignals(@Positive int limit);

    /**
     * 获取用户发布的信号数量。
     *
     * @param userId 用户ID
     * @return 信号数量
     */
    long countUserSignals(@NotNull @Positive Long userId);

    /**
     * 检查信号是否存在。
     *
     * @param signalId 信号ID
     * @return 是否存在
     */
    boolean exists(@NotNull @Positive Long signalId);

    /**
     * 检查信号是否属于指定用户。
     *
     * @param signalId 信号ID
     * @param userId 用户ID
     * @return 是否属于该用户
     */
    boolean belongsToUser(@NotNull @Positive Long signalId, @NotNull @Positive Long userId);
}
