package com.koduck.service.impl.portfolio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.common.constants.MarketConstants;
import com.koduck.config.CacheConfig;
import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;
import com.koduck.entity.portfolio.PortfolioPosition;
import com.koduck.entity.backtest.Trade;
import com.koduck.entity.enums.TradeType;
import com.koduck.repository.portfolio.PortfolioPositionRepository;
import com.koduck.repository.backtest.TradeRepository;
import com.koduck.service.KlineService;
import com.koduck.service.PortfolioService;

import lombok.extern.slf4j.Slf4j;

import static com.koduck.util.ServiceValidationUtils.assertOwner;
import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * 投资组合服务操作实现类.
 *
 * @author GitHub Copilot
 */
@Service
@Slf4j
public class PortfolioServiceImpl implements PortfolioService {

    /** 投资组合持仓仓库. */
    private final PortfolioPositionRepository positionRepository;

    /** 交易记录仓库. */
    private final TradeRepository tradeRepository;

    /** K线数据服务. */
    private final KlineService klineService;

    // Use MarketConstants.MarketConstants.DEFAULT_TIMEFRAME directly

    /** 空持仓错误消息. */
    private static final String POSITION_NULL_MESSAGE = "position must not be null";

    /** BigDecimal计算精度. */
    private static final int SCALE = 4;

    /** Percentage multiplier (100). */
    private static final int PERCENTAGE_MULTIPLIER = 100;

    /**
     * Constructs a new PortfolioServiceImpl.
     *
     * @param positionRepository the position repository
     * @param tradeRepository the trade repository
     * @param klineService the K-line service
     */
    public PortfolioServiceImpl(PortfolioPositionRepository positionRepository,
                                TradeRepository tradeRepository,
                                KlineService klineService) {
        this.positionRepository = positionRepository;
        this.tradeRepository = tradeRepository;
        this.klineService = klineService;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<PortfolioPositionDto> getPositions(Long userId) {
        log.debug("Getting portfolio positions for user: {}", userId);
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        return positions.stream()
            .map(this::convertToDtoWithCalculations)
            .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Cacheable(value = CacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public PortfolioSummaryDto getPortfolioSummary(Long userId) {
        log.debug("Getting portfolio summary for user: {}", userId);
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;
        BigDecimal totalDailyPnl = BigDecimal.ZERO;
        for (PortfolioPosition position : positions) {
            Optional<BigDecimal> currentPriceOpt = klineService.getLatestPrice(
                position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
            BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
            BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
            BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
            totalCost = totalCost.add(cost);
            totalMarketValue = totalMarketValue.add(marketValue);
            // Calculate daily PnL for this position
            Optional<BigDecimal> dailyPnlOpt = calculatePositionDailyPnl(position, currentPrice);
            totalDailyPnl = totalDailyPnl.add(dailyPnlOpt.orElse(BigDecimal.ZERO));
        }
        BigDecimal totalPnl = totalMarketValue.subtract(totalCost);
        BigDecimal totalPnlPercent = totalCost.compareTo(BigDecimal.ZERO) > 0
            ? totalPnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                .divide(totalCost, SCALE, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        // Calculate daily PnL percentage based on yesterday's total market value
        BigDecimal dailyPnlPercent = calculateDailyPnlPercent(
            totalDailyPnl, totalMarketValue, totalDailyPnl);
        return PortfolioSummaryDto.builder()
            .totalCost(totalCost)
            .totalMarketValue(totalMarketValue)
            .totalPnl(totalPnl)
            .totalPnlPercent(totalPnlPercent)
            .dailyPnl(totalDailyPnl)
            .dailyPnlPercent(dailyPnlPercent)
            .build();
    }

    /**
     * Calculate daily PnL for a single position.
     * Formula: (currentPrice - previousClosePrice) * quantity
     *
     * @param position the portfolio position
     * @param currentPrice the current market price
     * @return Optional of daily PnL, empty if previous close price not available
     */
    private Optional<BigDecimal> calculatePositionDailyPnl(
            PortfolioPosition position, BigDecimal currentPrice) {
        Optional<BigDecimal> prevCloseOpt = klineService.getPreviousClosePrice(
            position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        if (prevCloseOpt.isEmpty()) {
            log.warn("Previous close price not available for {}/{}, skipping daily PnL calculation",
                position.getMarket(), position.getSymbol());
            return Optional.empty();
        }
        BigDecimal prevClosePrice = prevCloseOpt.get();
        BigDecimal priceChange = currentPrice.subtract(prevClosePrice);
        BigDecimal dailyPnl = priceChange.multiply(position.getQuantity());
        log.debug("Daily PnL for {}: currentPrice={}, prevClose={}, change={}, quantity={}, dailyPnl={}",
            position.getSymbol(), currentPrice, prevClosePrice, priceChange,
            position.getQuantity(), dailyPnl);
        return Optional.of(dailyPnl);
    }

    /**
     * Calculate daily PnL percentage.
     * Formula: (dailyPnl / (totalMarketValue - dailyPnl)) * 100
     * The denominator is yesterday's total market value.
     *
     * @param dailyPnl the total daily profit/loss
     * @param totalMarketValue today's total market value
     * @param totalDailyPnl the total daily PnL (same as dailyPnl parameter)
     * @return daily PnL percentage
     */
    private BigDecimal calculateDailyPnlPercent(
            BigDecimal dailyPnl, BigDecimal totalMarketValue, BigDecimal totalDailyPnl) {
        // Yesterday's market value = today's market value - today's daily PnL
        BigDecimal yesterdayMarketValue = totalMarketValue.subtract(totalDailyPnl);
        if (yesterdayMarketValue.compareTo(BigDecimal.ZERO) <= 0) {
            log.debug("Yesterday's market value is zero or negative, "
                + "returning zero for daily PnL percent");
            return BigDecimal.ZERO;
        }
        return dailyPnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
            .divide(yesterdayMarketValue, SCALE, RoundingMode.HALF_UP);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = CacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
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
            PortfolioPosition saved = positionRepository.save(
                Objects.requireNonNull(existing, POSITION_NULL_MESSAGE));
            log.info("Updated position: id={}, user={}, symbol={}",
                saved.getId(), userId, request.symbol());
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
        PortfolioPosition saved = positionRepository.save(
            Objects.requireNonNull(position, POSITION_NULL_MESSAGE));
        log.info("Added position: id={}, user={}, symbol={}",
            saved.getId(), userId, request.symbol());
        return convertToDtoWithCalculations(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = CacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public PortfolioPositionDto updatePosition(Long userId, Long positionId,
                                               UpdatePositionRequest request) {
        log.debug("Updating position: user={}, positionId={}", userId, positionId);
        PortfolioPosition position = loadPositionOrThrow(positionId);
        assertOwner(position.getUserId(), userId, "Not authorized to update this position");
        if (request.quantity() != null) {
            position.setQuantity(request.quantity());
        }
        if (request.avgCost() != null) {
            position.setAvgCost(request.avgCost());
        }
        PortfolioPosition saved = positionRepository.save(
            Objects.requireNonNull(position, POSITION_NULL_MESSAGE));
        log.info("Updated position: id={}, user={}", saved.getId(), userId);
        return convertToDtoWithCalculations(saved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = CacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public void deletePosition(Long userId, Long positionId) {
        log.debug("Deleting position: user={}, positionId={}", userId, positionId);
        positionRepository.deleteByUserIdAndId(userId, positionId);
        log.info("Deleted position: user={}, positionId={}", userId, positionId);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<TradeDto> getTrades(Long userId) {
        log.debug("Getting trades for user: {}", userId);
        List<Trade> trades = tradeRepository.findByUserIdOrderByTradeTimeDesc(userId);
        return trades.stream()
            .map(this::convertTradeToDto)
            .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    @CacheEvict(value = CacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public TradeDto addTrade(Long userId, AddTradeRequest request) {
        log.debug("Adding trade: user={}, market={}, symbol={}, type={}, quantity={}",
                 userId, request.market(), request.symbol(),
                 request.tradeType(), request.quantity());
        // Calculate amount
        BigDecimal amount = request.price().multiply(request.quantity());
        // Create trade record
        Trade trade = Trade.builder()
            .userId(userId)
            .market(request.market())
            .symbol(request.symbol())
            .name(request.name())
            .tradeType(TradeType.valueOf(request.tradeType()))
            .quantity(request.quantity())
            .price(request.price())
            .amount(amount)
            .tradeTime(request.tradeTime() != null
                ? request.tradeTime() : LocalDateTime.now())
            .build();
        Trade savedTrade = tradeRepository.save(
            Objects.requireNonNull(trade, "trade must not be null"));
        // Update position based on trade
        updatePositionFromTrade(userId, request);
        log.info("Added trade: id={}, user={}, symbol={}",
            savedTrade.getId(), userId, request.symbol());
        return convertTradeToDto(savedTrade);
    }

    /**
     * Update position based on trade.
     */
    private void updatePositionFromTrade(Long userId, AddTradeRequest request) {
        Optional<PortfolioPosition> positionOpt = positionRepository
            .findByUserIdAndMarketAndSymbol(userId, request.market(), request.symbol());
        TradeType tradeType = TradeType.valueOf(request.tradeType());
        if (tradeType == TradeType.BUY) {
            // For buy trades, add to position or create new
            if (positionOpt.isPresent()) {
                PortfolioPosition position = positionOpt.get();
                BigDecimal totalQuantity = position.getQuantity().add(request.quantity());
                BigDecimal totalCost = position.getAvgCost().multiply(position.getQuantity())
                    .add(request.price().multiply(request.quantity()));
                BigDecimal newAvgCost = totalCost.divide(totalQuantity, SCALE, RoundingMode.HALF_UP);
                position.setQuantity(totalQuantity);
                position.setAvgCost(newAvgCost);
                positionRepository.save(
                    Objects.requireNonNull(position, POSITION_NULL_MESSAGE));
            }
            else {
                PortfolioPosition newPosition = PortfolioPosition.builder()
                    .userId(userId)
                    .market(request.market())
                    .symbol(request.symbol())
                    .name(request.name())
                    .quantity(request.quantity())
                    .avgCost(request.price())
                    .build();
                positionRepository.save(Objects.requireNonNull(newPosition,
                    "newPosition must not be null"));
            }
        }
        else if (tradeType == TradeType.SELL && positionOpt.isPresent()) {
            // For sell trades, reduce position
            PortfolioPosition position = positionOpt.get();
            BigDecimal remainingQuantity = position.getQuantity().subtract(request.quantity());
            if (remainingQuantity.compareTo(BigDecimal.ZERO) <= 0) {
                // Delete position if fully sold
                positionRepository.delete(position);
            }
            else {
                // Keep avg cost same for sell (FIFO accounting would be more complex)
                position.setQuantity(remainingQuantity);
                positionRepository.save(
                    Objects.requireNonNull(position, POSITION_NULL_MESSAGE));
            }
        }
    }

    /**
     * Convert position to DTO with calculations.
     *
     * @param position the portfolio position
     * @return the DTO
     */
    private PortfolioPositionDto convertToDtoWithCalculations(PortfolioPosition position) {
        // Get real-time price
        Optional<BigDecimal> currentPriceOpt = klineService.getLatestPrice(
            position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
        BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
        BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
        BigDecimal pnl = marketValue.subtract(cost);
        BigDecimal pnlPercent = cost.compareTo(BigDecimal.ZERO) > 0
            ? pnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                .divide(cost, SCALE, RoundingMode.HALF_UP)
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

    /**
     * Convert trade to DTO.
     *
     * @param trade the trade
     * @return the DTO
     */
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

    /**
     * Load position or throw exception if not found.
     *
     * @param positionId the position ID
     * @return the position
     */
    private PortfolioPosition loadPositionOrThrow(Long positionId) {
        Long nonNullPositionId = Objects.requireNonNull(positionId,
            "positionId must not be null");
        return requireFound(positionRepository.findById(nonNullPositionId),
                () -> new IllegalArgumentException("Position not found"));
    }
}
