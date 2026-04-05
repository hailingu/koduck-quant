package com.koduck.acl.impl;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.koduck.acl.BacktestQueryService;
import com.koduck.entity.backtest.BacktestResult;
import com.koduck.repository.backtest.BacktestResultRepository;

import lombok.RequiredArgsConstructor;

/**
 * 回测查询服务实现（防腐层）。
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
public class BacktestQueryServiceImpl implements BacktestQueryService {

    private final BacktestResultRepository backtestResultRepository;

    @Override
    public Optional<BacktestResultSummary> findResultById(Long resultId) {
        return backtestResultRepository.findById(resultId)
                .map(this::toSummary);
    }

    private BacktestResultSummary toSummary(BacktestResult result) {
        return new BacktestResultSummary(
                result.getId(),
                result.getSymbol(),
                "Strategy " + result.getStrategyId(),  // strategyName derived from strategyId
                result.getTotalReturn(),
                result.getMaxDrawdown(),
                result.getTotalTrades(),  // Field name is totalTrades, not tradeCount
                result.getSharpeRatio(),
                result.getWinRate()
        );
    }
}
