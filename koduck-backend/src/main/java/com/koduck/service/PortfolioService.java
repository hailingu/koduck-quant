package com.koduck.service;
import java.util.List;

import com.koduck.dto.portfolio.*;

/**
 * Service for portfolio operations.
 */
public interface PortfolioService {
    
    /**
     * Get user's portfolio positions with calculated values.
     */
    List<PortfolioPositionDto> getPositions(Long userId);
    
    /**
     * Get portfolio summary with daily PnL calculation.
     */
    PortfolioSummaryDto getPortfolioSummary(Long userId);
    
    /**
     * Add a position to portfolio.
     */
    PortfolioPositionDto addPosition(Long userId, AddPositionRequest request);
    
    /**
     * Update a position.
     */
    PortfolioPositionDto updatePosition(Long userId, Long positionId, UpdatePositionRequest request);
    
    /**
     * Delete a position.
     */
    void deletePosition(Long userId, Long positionId);
    
    /**
     * Get trade records for a user.
     */
    List<TradeDto> getTrades(Long userId);
    
    /**
     * Add a trade record and update position.
     */
    TradeDto addTrade(Long userId, AddTradeRequest request);
}
