package com.koduck.service;

import com.koduck.dto.portfolio.*;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Trade;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for portfolio operations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {
    
    private final PortfolioPositionRepository positionRepository;
    private final TradeRepository tradeRepository;
    private final KlineService klineService;
    
    private static final String DEFAULT_TIMEFRAME = "1D";
    private static final int SCALE = 4;
    
    /**
     * Get user's portfolio positions with calculated values.
     */
    public List<PortfolioPositionDto> getPositions(Long userId) {
        log.debug("Getting portfolio positions for user: {}", userId);
        
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        
        return positions.stream()
            .map(this::convertToDtoWithCalculations)
            .collect(Collectors.toList());
    }
    
    /**
     * Get portfolio summary.
     */
    public PortfolioSummaryDto getPortfolioSummary(Long userId) {
        log.debug("Getting portfolio summary for user: {}", userId);
        
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;
        
        for (PortfolioPosition position : positions) {
            Optional<BigDecimal> currentPriceOpt = klineService.getLatestPrice(
                position.getMarket(), position.getSymbol(), DEFAULT_TIMEFRAME);
            
            BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
            BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
            BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
            
            totalCost = totalCost.add(cost);
            totalMarketValue = totalMarketValue.add(marketValue);
        }
        
        BigDecimal totalPnl = totalMarketValue.subtract(totalCost);
        BigDecimal totalPnlPercent = totalCost.compareTo(BigDecimal.ZERO) > 0
            ? totalPnl.multiply(BigDecimal.valueOf(100)).divide(totalCost, SCALE, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        // TODO: Calculate daily PnL (need previous close price)
        BigDecimal dailyPnl = BigDecimal.ZERO;
        BigDecimal dailyPnlPercent = BigDecimal.ZERO;
        
        return PortfolioSummaryDto.builder()
            .totalCost(totalCost)
            .totalMarketValue(totalMarketValue)
            .totalPnl(totalPnl)
            .totalPnlPercent(totalPnlPercent)
            .dailyPnl(dailyPnl)
            .dailyPnlPercent(dailyPnlPercent)
            .build();
    }
    
    /**
     * Add a position to portfolio.
     */
    @Transactional
    public PortfolioPositionDto addPosition(Long userId, AddPositionRequest request) {
        log.debug("Adding position: user={}, market={}, symbol={}, quantity={}", 
                 userId, request.market(), request.symbol(), request.quantity());
        
        // Check if position already exists
        Optional<PortfolioPosition> existingOpt = positionRepository
            .findByUserIdAndMarketAndSymbol(userId, request.market(), request.symbol());
        
        if (existingOpt.isPresent()) {
            // Update existing position with weighted average cost
            PortfolioPosition existing = existingOpt.get();
            BigDecimal totalQuantity = existing.getQuantity().add(request.quantity());
            BigDecimal totalCost = existing.getAvgCost().multiply(existing.getQuantity())
                .add(request.avgCost().multiply(request.quantity()));
            BigDecimal newAvgCost = totalCost.divide(totalQuantity, SCALE, RoundingMode.HALF_UP);
            
            existing.setQuantity(totalQuantity);
            existing.setAvgCost(newAvgCost);
            existing.setName(request.name());
            
            PortfolioPosition saved = positionRepository.save(existing);
            log.info("Updated position: id={}, user={}, symbol={}", saved.getId(), userId, request.symbol());
            return convertToDtoWithCalculations(saved);
        }
        
        // Create new position
        PortfolioPosition position = PortfolioPosition.builder()
            .userId(userId)
            .market(request.market())
            .symbol(request.symbol())
            .name(request.name())
            .quantity(request.quantity())
            .avgCost(request.avgCost())
            .build();
        
        PortfolioPosition saved = positionRepository.save(position);
        log.info("Added position: id={}, user={}, symbol={}", saved.getId(), userId, request.symbol());
        
        return convertToDtoWithCalculations(saved);
    }
    
    /**
     * Update a position.
     */
    @Transactional
    public PortfolioPositionDto updatePosition(Long userId, Long positionId, UpdatePositionRequest request) {
        log.debug("Updating position: user={}, positionId={}", userId, positionId);
        
        PortfolioPosition position = positionRepository.findById(positionId)
            .orElseThrow(() -> new IllegalArgumentException("Position not found"));
        
        if (!position.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to update this position");
        }
        
        if (request.quantity() != null) {
            position.setQuantity(request.quantity());
        }
        if (request.avgCost() != null) {
            position.setAvgCost(request.avgCost());
        }
        
        PortfolioPosition saved = positionRepository.save(position);
        log.info("Updated position: id={}, user={}", saved.getId(), userId);
        
        return convertToDtoWithCalculations(saved);
    }
    
    /**
     * Delete a position.
     */
    @Transactional
    public void deletePosition(Long userId, Long positionId) {
        log.debug("Deleting position: user={}, positionId={}", userId, positionId);
        
        positionRepository.deleteByUserIdAndId(userId, positionId);
        log.info("Deleted position: user={}, positionId={}", userId, positionId);
    }
    
    /**
     * Get trade records for a user.
     */
    public List<TradeDto> getTrades(Long userId) {
        log.debug("Getting trades for user: {}", userId);
        
        List<Trade> trades = tradeRepository.findByUserIdOrderByTradeTimeDesc(userId);
        
        return trades.stream()
            .map(this::convertTradeToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Add a trade record and update position.
     */
    @Transactional
    public TradeDto addTrade(Long userId, AddTradeRequest request) {
        log.debug("Adding trade: user={}, market={}, symbol={}, type={}, quantity={}", 
                 userId, request.market(), request.symbol(), request.tradeType(), request.quantity());
        
        // Calculate amount
        BigDecimal amount = request.price().multiply(request.quantity());
        
        // Create trade record
        Trade trade = Trade.builder()
            .userId(userId)
            .market(request.market())
            .symbol(request.symbol())
            .name(request.name())
            .tradeType(Trade.TradeType.valueOf(request.tradeType()))
            .quantity(request.quantity())
            .price(request.price())
            .amount(amount)
            .tradeTime(request.tradeTime() != null ? request.tradeTime() : LocalDateTime.now())
            .build();
        
        Trade savedTrade = tradeRepository.save(trade);
        
        // Update position based on trade
        updatePositionFromTrade(userId, request);
        
        log.info("Added trade: id={}, user={}, symbol={}", savedTrade.getId(), userId, request.symbol());
        
        return convertTradeToDto(savedTrade);
    }
    
    /**
     * Update position based on trade.
     */
    private void updatePositionFromTrade(Long userId, AddTradeRequest request) {
        Optional<PortfolioPosition> positionOpt = positionRepository
            .findByUserIdAndMarketAndSymbol(userId, request.market(), request.symbol());
        
        Trade.TradeType tradeType = Trade.TradeType.valueOf(request.tradeType());
        
        if (tradeType == Trade.TradeType.BUY) {
            // For buy trades, add to position or create new
            if (positionOpt.isPresent()) {
                PortfolioPosition position = positionOpt.get();
                BigDecimal totalQuantity = position.getQuantity().add(request.quantity());
                BigDecimal totalCost = position.getAvgCost().multiply(position.getQuantity())
                    .add(request.price().multiply(request.quantity()));
                BigDecimal newAvgCost = totalCost.divide(totalQuantity, SCALE, RoundingMode.HALF_UP);
                
                position.setQuantity(totalQuantity);
                position.setAvgCost(newAvgCost);
                positionRepository.save(position);
            } else {
                PortfolioPosition newPosition = PortfolioPosition.builder()
                    .userId(userId)
                    .market(request.market())
                    .symbol(request.symbol())
                    .name(request.name())
                    .quantity(request.quantity())
                    .avgCost(request.price())
                    .build();
                positionRepository.save(newPosition);
            }
        } else if (tradeType == Trade.TradeType.SELL) {
            // For sell trades, reduce position
            if (positionOpt.isPresent()) {
                PortfolioPosition position = positionOpt.get();
                BigDecimal remainingQuantity = position.getQuantity().subtract(request.quantity());
                
                if (remainingQuantity.compareTo(BigDecimal.ZERO) <= 0) {
                    // Delete position if fully sold
                    positionRepository.delete(position);
                } else {
                    // Keep avg cost same for sell (FIFO accounting would be more complex)
                    position.setQuantity(remainingQuantity);
                    positionRepository.save(position);
                }
            }
        }
    }
    
    private PortfolioPositionDto convertToDtoWithCalculations(PortfolioPosition position) {
        // Get real-time price
        Optional<BigDecimal> currentPriceOpt = klineService.getLatestPrice(
            position.getMarket(), position.getSymbol(), DEFAULT_TIMEFRAME);
        
        BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
        BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
        BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
        BigDecimal pnl = marketValue.subtract(cost);
        BigDecimal pnlPercent = cost.compareTo(BigDecimal.ZERO) > 0
            ? pnl.multiply(BigDecimal.valueOf(100)).divide(cost, SCALE, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        return PortfolioPositionDto.builder()
            .id(position.getId())
            .market(position.getMarket())
            .symbol(position.getSymbol())
            .name(position.getName())
            .quantity(position.getQuantity())
            .avgCost(position.getAvgCost())
            .currentPrice(currentPrice)
            .marketValue(marketValue)
            .pnl(pnl)
            .pnlPercent(pnlPercent)
            .createdAt(position.getCreatedAt())
            .updatedAt(position.getUpdatedAt())
            .build();
    }
    
    private TradeDto convertTradeToDto(Trade trade) {
        return TradeDto.builder()
            .id(trade.getId())
            .market(trade.getMarket())
            .symbol(trade.getSymbol())
            .name(trade.getName())
            .tradeType(trade.getTradeType().name())
            .quantity(trade.getQuantity())
            .price(trade.getPrice())
            .amount(trade.getAmount())
            .tradeTime(trade.getTradeTime())
            .createdAt(trade.getCreatedAt())
            .build();
    }
}
