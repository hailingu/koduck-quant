package com.koduck.portfolio.api;

import java.util.List;
import java.util.Optional;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import com.koduck.portfolio.dto.PortfolioPositionDto;
import com.koduck.portfolio.dto.PortfolioSummaryDto;
import com.koduck.portfolio.dto.TradeDto;

/**
 * 投资组合查询服务接口。
 *
 * <p>提供投资组合、持仓、交易记录的查询能力。</p>
 *
 * @author Koduck Team
 * @see PortfolioCommandService
 */
public interface PortfolioQueryService {

    /**
     * 获取用户的投资组合汇总信息。
     *
     * @param userId 用户ID
     * @return 投资组合汇总
     */
    Optional<PortfolioSummaryDto> getPortfolioSummary(@NotNull @Positive Long userId);

    /**
     * 获取用户的所有持仓。
     *
     * @param userId 用户ID
     * @return 持仓列表
     */
    List<PortfolioPositionDto> getPositions(@NotNull @Positive Long userId);

    /**
     * 获取单个持仓详情。
     *
     * @param positionId 持仓ID
     * @return 持仓详情
     */
    Optional<PortfolioPositionDto> getPosition(@NotNull @Positive Long positionId);

    /**
     * 获取用户的交易记录。
     *
     * @param userId   用户ID
     * @param page     页码（从1开始）
     * @param pageSize 每页大小
     * @return 交易记录列表
     */
    List<TradeDto> getTrades(
            @NotNull @Positive Long userId,
            @Positive int page,
            @Positive int pageSize);

    /**
     * 获取某只股票的交易记录。
     *
     * @param userId   用户ID
     * @param symbol   股票代码
     * @param page     页码
     * @param pageSize 每页大小
     * @return 交易记录列表
     */
    List<TradeDto> getTradesBySymbol(
            @NotNull @Positive Long userId,
            @NotNull String symbol,
            @Positive int page,
            @Positive int pageSize);
}
