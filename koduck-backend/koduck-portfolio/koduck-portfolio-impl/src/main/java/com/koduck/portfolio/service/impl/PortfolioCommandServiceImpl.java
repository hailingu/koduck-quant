package com.koduck.portfolio.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.portfolio.api.PortfolioCommandService;
import com.koduck.portfolio.config.PortfolioCacheConfig;
import com.koduck.portfolio.entity.PortfolioPosition;
import com.koduck.portfolio.entity.Trade;
import com.koduck.portfolio.entity.TradeType;
import com.koduck.portfolio.repository.PortfolioPositionRepository;
import com.koduck.portfolio.repository.TradeRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 投资组合命令服务实现类。
 *
 * <p>实现 {@link PortfolioCommandService} 接口，提供投资组合写操作。</p>
 *
 * @author Koduck Team
 * @see PortfolioCommandService
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioCommandServiceImpl implements PortfolioCommandService {

    /** BigDecimal计算精度。 */
    private static final int SCALE = 4;

    /** 空持仓错误消息。 */
    private static final String POSITION_NULL_MESSAGE = "position must not be null";

    private final PortfolioPositionRepository positionRepository;
    private final TradeRepository tradeRepository;

    @Override
    @Transactional
    @CacheEvict(value = PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public Long addPosition(Long userId, String market, String symbol,
                           BigDecimal quantity, BigDecimal avgCost) {
        log.debug("Adding position: user={}, market={}, symbol={}, quantity={}",
                userId, market, symbol, quantity);

        Optional<PortfolioPosition> existingOpt = positionRepository
                .findByUserIdAndMarketAndSymbol(userId, market, symbol);

        if (existingOpt.isPresent()) {
            // Update existing position with weighted average cost
            PortfolioPosition existing = existingOpt.get();
            BigDecimal totalQuantity = existing.getQuantity().add(quantity);
            BigDecimal totalCost = existing.getAvgCost().multiply(existing.getQuantity())
                    .add(avgCost.multiply(quantity));
            BigDecimal newAvgCost = totalCost.divide(totalQuantity, SCALE, RoundingMode.HALF_UP);

            existing.setQuantity(totalQuantity);
            existing.setAvgCost(newAvgCost);
            PortfolioPosition saved = positionRepository.save(existing);
            log.info("Updated position: id={}, user={}, symbol={}", saved.getId(), userId, symbol);
            return saved.getId();
        }

        // Create new position
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market(market)
                .symbol(symbol)
                .quantity(quantity)
                .avgCost(avgCost)
                .build();

        PortfolioPosition saved = positionRepository.save(
                Objects.requireNonNull(position, POSITION_NULL_MESSAGE));
        log.info("Added position: id={}, user={}, symbol={}", saved.getId(), userId, symbol);
        return saved.getId();
    }

    @Override
    @Transactional
    @CacheEvict(value = PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public boolean updatePosition(Long positionId, BigDecimal quantity, BigDecimal avgCost) {
        log.debug("Updating position: positionId={}, quantity={}, avgCost={}",
                positionId, quantity, avgCost);

        Optional<PortfolioPosition> positionOpt = positionRepository.findById(positionId);
        if (positionOpt.isEmpty()) {
            log.warn("Position not found: {}", positionId);
            return false;
        }

        PortfolioPosition position = positionOpt.get();
        position.setQuantity(quantity);
        position.setAvgCost(avgCost);
        positionRepository.save(position);
        log.info("Updated position: id={}", positionId);
        return true;
    }

    @Override
    @Transactional
    @CacheEvict(value = PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public boolean deletePosition(Long positionId) {
        log.debug("Deleting position: {}", positionId);

        if (!positionRepository.existsById(positionId)) {
            log.warn("Position not found: {}", positionId);
            return false;
        }

        positionRepository.deleteById(positionId);
        log.info("Deleted position: {}", positionId);
        return true;
    }

    @Override
    @Transactional
    @CacheEvict(value = PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY, key = "#userId")
    public Long recordTrade(Long userId, String market, String symbol,
                           String tradeType, BigDecimal quantity,
                           BigDecimal price, String notes) {
        log.debug("Recording trade: user={}, market={}, symbol={}, type={}, quantity={}",
                userId, market, symbol, tradeType, quantity);

        BigDecimal amount = price.multiply(quantity);
        TradeType type = TradeType.valueOf(tradeType);

        Trade trade = Trade.builder()
                .userId(userId)
                .market(market)
                .symbol(symbol)
                .tradeType(type)
                .quantity(quantity)
                .price(price)
                .amount(amount)
                .tradeTime(LocalDateTime.now())
                .build();

        Trade savedTrade = tradeRepository.save(
                Objects.requireNonNull(trade, "trade must not be null"));

        // Update position based on trade
        updatePositionFromTrade(userId, market, symbol, type, quantity, price);

        log.info("Recorded trade: id={}, user={}, symbol={}", savedTrade.getId(), userId, symbol);
        return savedTrade.getId();
    }

    /**
     * Update position based on trade.
     */
    private void updatePositionFromTrade(Long userId, String market, String symbol,
                                        TradeType tradeType, BigDecimal quantity,
                                        BigDecimal price) {
        Optional<PortfolioPosition> positionOpt = positionRepository
                .findByUserIdAndMarketAndSymbol(userId, market, symbol);

        if (tradeType == TradeType.BUY) {
            handleBuyTrade(positionOpt, userId, market, symbol, quantity, price);
        } else if (tradeType == TradeType.SELL) {
            handleSellTrade(positionOpt, quantity);
        }
    }

    /**
     * Handle buy trade - add to position or create new.
     */
    private void handleBuyTrade(Optional<PortfolioPosition> positionOpt, Long userId,
                               String market, String symbol, BigDecimal quantity,
                               BigDecimal price) {
        if (positionOpt.isPresent()) {
            PortfolioPosition position = positionOpt.get();
            BigDecimal totalQuantity = position.getQuantity().add(quantity);
            BigDecimal totalCost = position.getAvgCost().multiply(position.getQuantity())
                    .add(price.multiply(quantity));
            BigDecimal newAvgCost = totalCost.divide(totalQuantity, SCALE, RoundingMode.HALF_UP);

            position.setQuantity(totalQuantity);
            position.setAvgCost(newAvgCost);
            positionRepository.save(position);
        } else {
            PortfolioPosition newPosition = PortfolioPosition.builder()
                    .userId(userId)
                    .market(market)
                    .symbol(symbol)
                    .quantity(quantity)
                    .avgCost(price)
                    .build();
            positionRepository.save(newPosition);
        }
    }

    /**
     * Handle sell trade - reduce or delete position.
     */
    private void handleSellTrade(Optional<PortfolioPosition> positionOpt, BigDecimal quantity) {
        if (positionOpt.isEmpty()) {
            log.warn("Sell trade for non-existent position");
            return;
        }

        PortfolioPosition position = positionOpt.get();
        BigDecimal remainingQuantity = position.getQuantity().subtract(quantity);

        if (remainingQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            // Delete position if fully sold
            positionRepository.delete(position);
        } else {
            // Keep avg cost same for sell
            position.setQuantity(remainingQuantity);
            positionRepository.save(position);
        }
    }
}
