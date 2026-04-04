package com.koduck.service;

import java.util.List;

import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;

/**
 * 投资组合操作服务。
 *
 * @author Koduck Team
 */
public interface PortfolioService {

    /**
     * 获取用户的投资组合持仓（含计算后的市值）。
     *
     * @param userId 用户ID
     * @return 投资组合持仓列表
     */
    List<PortfolioPositionDto> getPositions(Long userId);

    /**
     * 获取投资组合摘要（含日盈亏计算）。
     *
     * @param userId 用户ID
     * @return 投资组合摘要
     */
    PortfolioSummaryDto getPortfolioSummary(Long userId);

    /**
     * 向投资组合中添加持仓。
     *
     * @param userId  用户ID
     * @param request 添加持仓请求
     * @return 添加的持仓
     */
    PortfolioPositionDto addPosition(Long userId, AddPositionRequest request);

    /**
     * 更新持仓。
     *
     * @param userId     用户ID
     * @param positionId 持仓ID
     * @param request    更新请求
     * @return 更新后的持仓
     */
    PortfolioPositionDto updatePosition(Long userId, Long positionId, UpdatePositionRequest request);

    /**
     * 删除持仓。
     *
     * @param userId     用户ID
     * @param positionId 持仓ID
     */
    void deletePosition(Long userId, Long positionId);

    /**
     * 获取用户的交易记录。
     *
     * @param userId 用户ID
     * @return 交易记录列表
     */
    List<TradeDto> getTrades(Long userId);

    /**
     * 添加交易记录并更新持仓。
     *
     * @param userId  用户ID
     * @param request 添加交易请求
     * @return 添加的交易
     */
    TradeDto addTrade(Long userId, AddTradeRequest request);
}
