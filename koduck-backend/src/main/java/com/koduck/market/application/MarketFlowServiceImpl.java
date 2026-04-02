package com.koduck.market.application;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.mapper.MarketDataMapper;
import com.koduck.repository.MarketDailyNetFlowRepository;
import com.koduck.service.MarketFlowService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MarketFlowServiceImpl implements MarketFlowService {
    private final MarketDailyNetFlowRepository marketDailyNetFlowRepository;
    private final MarketDataMapper marketDataMapper;
    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getLatestDailyNetFlow(String market, String flowType) {
        return marketDailyNetFlowRepository
                .findFirstByMarketAndFlowTypeOrderByTradeDateDesc(market, flowType)
            .map(marketDataMapper::toDto)
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getDailyNetFlow(String market, String flowType, LocalDate tradeDate) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDate(market, flowType, tradeDate)
            .map(marketDataMapper::toDto)
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public List<DailyNetFlowDto> getDailyNetFlowHistory(String market, String flowType, LocalDate from, LocalDate to) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDateBetweenOrderByTradeDateAsc(market, flowType, from, to)
                .stream()
            .map(marketDataMapper::toDto)
                .toList();
    }
}
