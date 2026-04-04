package com.koduck.acl.impl;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.koduck.acl.PortfolioQueryService;
import com.koduck.entity.portfolio.PortfolioPosition;
import com.koduck.repository.portfolio.PortfolioPositionRepository;

import lombok.RequiredArgsConstructor;

/**
 * 投资组合查询服务实现（防腐层）。
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
public class PortfolioQueryServiceImpl implements PortfolioQueryService {

    private final PortfolioPositionRepository positionRepository;

    @Override
    public List<PortfolioPositionSummary> findPositionsByUserId(Long userId) {
        return positionRepository.findByUserId(userId).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<PortfolioPositionSummary> findPositionById(Long positionId) {
        return positionRepository.findById(positionId)
                .map(this::toSummary);
    }

    private PortfolioPositionSummary toSummary(PortfolioPosition position) {
        return new PortfolioPositionSummary(
                position.getId(),
                position.getSymbol(),
                position.getMarket(),
                position.getQuantity(),
                position.getAvgCost(),  // Field name is avgCost, not averagePrice
                null  // currentPrice field does not exist
        );
    }
}
