package com.koduck.service;

import java.util.List;

import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;

/**
 * Service for portfolio operations.
 *
 * @author Koduck Team
 */
public interface PortfolioService {

    /**
     * Get user's portfolio positions with calculated values.
     *
     * @param userId the user ID
     * @return the list of portfolio positions
     */
    List<PortfolioPositionDto> getPositions(Long userId);

    /**
     * Get portfolio summary with daily PnL calculation.
     *
     * @param userId the user ID
     * @return the portfolio summary
     */
    PortfolioSummaryDto getPortfolioSummary(Long userId);

    /**
     * Add a position to portfolio.
     *
     * @param userId  the user ID
     * @param request the add position request
     * @return the added position
     */
    PortfolioPositionDto addPosition(Long userId, AddPositionRequest request);

    /**
     * Update a position.
     *
     * @param userId     the user ID
     * @param positionId the position ID
     * @param request    the update request
     * @return the updated position
     */
    PortfolioPositionDto updatePosition(Long userId, Long positionId, UpdatePositionRequest request);

    /**
     * Delete a position.
     *
     * @param userId     the user ID
     * @param positionId the position ID
     */
    void deletePosition(Long userId, Long positionId);

    /**
     * Get trade records for a user.
     *
     * @param userId the user ID
     * @return the list of trade records
     */
    List<TradeDto> getTrades(Long userId);

    /**
     * Add a trade record and update position.
     *
     * @param userId  the user ID
     * @param request the add trade request
     * @return the added trade
     */
    TradeDto addTrade(Long userId, AddTradeRequest request);
}
