package com.koduck.portfolio.acl.impl;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.koduck.common.constants.MarketConstants;
import com.koduck.portfolio.api.acl.PortfolioQueryService;
import com.koduck.portfolio.dto.PortfolioSnapshot;
import com.koduck.portfolio.dto.PortfolioSnapshot.PositionSnapshot;
import com.koduck.portfolio.entity.PortfolioPosition;
import com.koduck.portfolio.repository.PortfolioPositionRepository;
import com.koduck.portfolio.service.PortfolioPriceService;

import lombok.RequiredArgsConstructor;

/**
 * 投资组合查询服务 ACL 实现。
 *
 * <p>实现 {@link PortfolioQueryService} 接口，为其他领域模块提供投资组合数据访问。</p>
 *
 * @author Koduck Team
 * @see PortfolioQueryService
 */
@Service
@RequiredArgsConstructor
public class PortfolioAclServiceImpl implements PortfolioQueryService {

    private final PortfolioPositionRepository positionRepository;
    private final PortfolioPriceService priceService;

    @Override
    public Optional<PortfolioSnapshot> getSnapshot(Long portfolioId) {
        // 在当前的简化模型中，portfolioId 对应 positionId
        return positionRepository.findById(portfolioId)
                .map(this::toSnapshot);
    }

    @Override
    public List<PortfolioSnapshot> getSnapshots(List<Long> portfolioIds) {
        if (portfolioIds == null || portfolioIds.isEmpty()) {
            return Collections.emptyList();
        }
        return positionRepository.findAllById(portfolioIds).stream()
                .map(this::toSnapshot)
                .collect(Collectors.toList());
    }

    @Override
    public List<PortfolioSnapshot> getUserSnapshots(Long userId) {
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        if (positions.isEmpty()) {
            return Collections.emptyList();
        }

        // 按市场分组，每个市场作为一个 portfolio
        return positions.stream()
                .collect(Collectors.groupingBy(PortfolioPosition::getMarket))
                .entrySet().stream()
                .map(entry -> toMarketPortfolio(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    /**
     * Convert position to snapshot.
     */
    private PortfolioSnapshot toSnapshot(PortfolioPosition position) {
        Optional<BigDecimal> currentPriceOpt = priceService.getLatestPrice(
                position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
        BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
        BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
        BigDecimal pnl = marketValue.subtract(cost);

        PositionSnapshot positionSnapshot = new PositionSnapshot(
                position.getId(),
                position.getSymbol(),
                position.getMarket(),
                position.getQuantity(),
                position.getAvgCost(),
                currentPrice,
                marketValue
        );

        BigDecimal pnlPercent = cost.compareTo(BigDecimal.ZERO) > 0
                ? pnl.multiply(BigDecimal.valueOf(100)).divide(cost, 4, BigDecimal.ROUND_HALF_UP)
                : BigDecimal.ZERO;

        return new PortfolioSnapshot(
                position.getId(),
                position.getSymbol() + " Portfolio",
                Collections.singletonList(positionSnapshot),
                marketValue,
                cost,
                pnl,
                pnlPercent
        );
    }

    /**
     * Convert market positions to portfolio snapshot.
     */
    private PortfolioSnapshot toMarketPortfolio(String market, List<PortfolioPosition> positions) {
        List<PositionSnapshot> positionSnapshots = positions.stream()
                .map(this::toPositionSnapshot)
                .collect(Collectors.toList());

        BigDecimal totalValue = positionSnapshots.stream()
                .map(PositionSnapshot::marketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCost = positions.stream()
                .map(p -> p.getAvgCost().multiply(p.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPnl = totalValue.subtract(totalCost);
        BigDecimal totalPnlPercent = totalCost.compareTo(BigDecimal.ZERO) > 0
                ? totalPnl.multiply(BigDecimal.valueOf(100)).divide(totalCost, 4, BigDecimal.ROUND_HALF_UP)
                : BigDecimal.ZERO;

        return new PortfolioSnapshot(
                null, // 市场组合没有单一ID
                market + " Portfolio",
                positionSnapshots,
                totalValue,
                totalCost,
                totalPnl,
                totalPnlPercent
        );
    }

    /**
     * Convert position to position snapshot.
     */
    private PositionSnapshot toPositionSnapshot(PortfolioPosition position) {
        Optional<BigDecimal> currentPriceOpt = priceService.getLatestPrice(
                position.getMarket(), position.getSymbol(), MarketConstants.DEFAULT_TIMEFRAME);
        BigDecimal currentPrice = currentPriceOpt.orElse(position.getAvgCost());
        BigDecimal marketValue = currentPrice.multiply(position.getQuantity());

        return new PositionSnapshot(
                position.getId(),
                position.getSymbol(),
                position.getMarket(),
                position.getQuantity(),
                position.getAvgCost(),
                currentPrice,
                marketValue
        );
    }
}
