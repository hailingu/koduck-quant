package com.koduck.acl.impl;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.koduck.acl.StrategyQueryService;
import com.koduck.entity.strategy.Strategy;
import com.koduck.repository.strategy.StrategyRepository;

import lombok.RequiredArgsConstructor;

/**
 * 策略查询服务实现（防腐层）。
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
public class StrategyQueryServiceImpl implements StrategyQueryService {

    private final StrategyRepository strategyRepository;

    @Override
    public Optional<StrategySummary> findStrategyById(Long strategyId) {
        return strategyRepository.findById(strategyId)
                .map(this::toSummary);
    }

    @Override
    public List<StrategySummary> findStrategiesByUserId(Long userId) {
        return strategyRepository.findByUserId(userId).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    private StrategySummary toSummary(Strategy strategy) {
        return new StrategySummary(
                strategy.getId(),
                strategy.getName(),
                null,  // Strategy entity does not have type field
                strategy.getDescription()
        );
    }
}
