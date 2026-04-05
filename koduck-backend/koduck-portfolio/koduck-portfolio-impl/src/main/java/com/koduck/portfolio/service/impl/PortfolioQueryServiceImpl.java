package com.koduck.portfolio.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.koduck.common.constants.MarketConstants;
import com.koduck.portfolio.api.PortfolioQueryService;
import com.koduck.portfolio.config.PortfolioCacheConfig;
import com.koduck.portfolio.dto.PortfolioPositionDto;
import com.koduck.portfolio.dto.PortfolioSummaryDto;
import com.koduck.portfolio.dto.TradeDto;
import com.koduck.portfolio.entity.PortfolioPosition;
import com.koduck.portfolio.entity.Trade;
import com.koduck.portfolio.repository.PortfolioPositionRepository;
import com.koduck.portfolio.repository.TradeRepository;
import com.koduck.portfolio.service.PortfolioPriceService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 投资组合查询服务实现类。
 *
 * <p>实现 {@link PortfolioQueryService} 接口，提供投资组合查询能力。</p>
 *
 * @author Koduck Team
 * @see PortfolioQueryService
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioQueryServiceImpl implements PortfolioQueryService {

    /** BigDecimal计算精度。 */
    private static final int SCALE = 4;

    /** Percentage multiplier (100). */
    private static final int PERCENTAGE_MULTIPLIER = 100;

    /** 默认页大小。 */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final PortfolioPositionRepository positionRepository;
    private final TradeRepository tradeRepository;
    private final PortfolioPriceService priceService;

    @Override
    @Cacheable(value = PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public Optional<PortfolioSummaryDto> getPortfolioSummary(Long userId) {
        log.debug("Getting portfolio summary for user: {}", userId);
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        
        if (positions.isEmpty()) {
            return Optional.empty();
        }

        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;
        BigDecimal totalDailyPnl = BigDecimal.ZERO;

        for (PortfolioPosition position : positions) {
            Optional<BigDecimal> currentPriceOpt = priceService.getLatestPrice(
                    position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
            BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
            BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
            BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
            totalCost = totalCost.add(cost);
            totalMarketValue = totalMarketValue.add(marketValue);

            Optional<BigDecimal> dailyPnlOpt = calculatePositionDailyPnl(position, currentPrice);
            totalDailyPnl = totalDailyPnl.add(dailyPnlOpt.orElse(BigDecimal.ZERO));
        }

        BigDecimal totalPnl = totalMarketValue.subtract(totalCost);
        BigDecimal totalPnlPercent = totalCost.compareTo(BigDecimal.ZERO) > 0
                ? totalPnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                        .divide(totalCost, SCALE, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal dailyPnlPercent = calculateDailyPnlPercent(totalDailyPnl, totalMarketValue);

        PortfolioSummaryDto summary = new PortfolioSummaryDto(
                totalCost,
                totalMarketValue,
                totalPnl,
                totalPnlPercent,
                totalDailyPnl,
                dailyPnlPercent
        );

        return Optional.of(summary);
    }

    @Override
    public List<PortfolioPositionDto> getPositions(Long userId) {
        log.debug("Getting portfolio positions for user: {}", userId);
        return positionRepository.findByUserId(userId).stream()
                .map(this::convertToDto)
                .toList();
    }

    @Override
    public Optional<PortfolioPositionDto> getPosition(Long positionId) {
        log.debug("Getting position: {}", positionId);
        return positionRepository.findById(positionId)
                .map(this::convertToDto);
    }

    @Override
    public List<TradeDto> getTrades(Long userId, int page, int pageSize) {
        log.debug("Getting trades for user: {}, page: {}, pageSize: {}", userId, page, pageSize);
        int size = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
        int offset = (Math.max(page, 1) - 1) * size;

        List<Trade> trades = tradeRepository.findByUserIdOrderByTradeTimeDesc(userId);
        return trades.stream()
                .skip(offset)
                .limit(size)
                .map(this::convertTradeToDto)
                .toList();
    }

    @Override
    public List<TradeDto> getTradesBySymbol(Long userId, String symbol, int page, int pageSize) {
        log.debug("Getting trades for user: {}, symbol: {}, page: {}, pageSize: {}", 
                userId, symbol, page, pageSize);
        int size = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
        int offset = (Math.max(page, 1) - 1) * size;

        List<Trade> trades = tradeRepository.findByUserIdAndSymbolOrderByTradeTimeDesc(userId, symbol);
        return trades.stream()
                .skip(offset)
                .limit(size)
                .map(this::convertTradeToDto)
                .toList();
    }

    /**
     * Calculate daily PnL for a single position.
     */
    private Optional<BigDecimal> calculatePositionDailyPnl(PortfolioPosition position, BigDecimal currentPrice) {
        Optional<BigDecimal> prevCloseOpt = priceService.getPreviousClosePrice(
                position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        if (prevCloseOpt.isEmpty()) {
            log.warn("Previous close price not available for {}/{}",
                    position.getMarket(), position.getSymbol());
            return Optional.empty();
        }
        BigDecimal prevClosePrice = prevCloseOpt.get();
        BigDecimal priceChange = currentPrice.subtract(prevClosePrice);
        return Optional.of(priceChange.multiply(position.getQuantity()));
    }

    /**
     * Calculate daily PnL percentage.
     */
    private BigDecimal calculateDailyPnlPercent(BigDecimal dailyPnl, BigDecimal totalMarketValue) {
        BigDecimal yesterdayMarketValue = totalMarketValue.subtract(dailyPnl);
        if (yesterdayMarketValue.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return dailyPnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                .divide(yesterdayMarketValue, SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Convert position to DTO with calculations.
     */
    private PortfolioPositionDto convertToDto(PortfolioPosition position) {
        Optional<BigDecimal> currentPriceOpt = priceService.getLatestPrice(
                position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
        BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
        BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
        BigDecimal pnl = marketValue.subtract(cost);
        BigDecimal pnlPercent = cost.compareTo(BigDecimal.ZERO) > 0
                ? pnl.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                        .divide(cost, SCALE, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new PortfolioPositionDto(
                position.getId(),
                position.getMarket(),
                position.getSymbol(),
                position.getName(),
                position.getQuantity(),
                position.getAvgCost(),
                currentPrice,
                marketValue,
                pnl,
                pnlPercent,
                position.getCreatedAt(),
                position.getUpdatedAt()
        );
    }

    /**
     * Convert trade to DTO.
     */
    private TradeDto convertTradeToDto(Trade trade) {
        return new TradeDto(
                trade.getId(),
                trade.getMarket(),
                trade.getSymbol(),
                trade.getName(),
                trade.getTradeType().name(),
                null,  // status
                null,  // notes
                trade.getQuantity(),
                trade.getPrice(),
                trade.getAmount(),
                trade.getTradeTime(),
                trade.getCreatedAt()
        );
    }
}
