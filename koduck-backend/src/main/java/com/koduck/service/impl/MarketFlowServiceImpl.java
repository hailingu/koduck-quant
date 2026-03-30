package com.koduck.service.impl;
import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.entity.MarketDailyNetFlow;
import com.koduck.mapper.MarketFlowMapper;
import com.koduck.repository.MarketDailyNetFlowRepository;
import com.koduck.service.MarketFlowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
@Service
@RequiredArgsConstructor
public class MarketFlowServiceImpl implements MarketFlowService {
    private final MarketDailyNetFlowRepository marketDailyNetFlowRepository;
    private final MarketFlowMapper marketFlowMapper;
    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getLatestDailyNetFlow(String market, String flowType) {
        return marketDailyNetFlowRepository
                .findFirstByMarketAndFlowTypeOrderByTradeDateDesc(market, flowType)
            .map(marketFlowMapper::toDto)
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getDailyNetFlow(String market, String flowType, LocalDate tradeDate) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDate(market, flowType, tradeDate)
            .map(marketFlowMapper::toDto)
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public List<DailyNetFlowDto> getDailyNetFlowHistory(String market, String flowType, LocalDate from, LocalDate to) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDateBetweenOrderByTradeDateAsc(market, flowType, from, to)
                .stream()
            .map(marketFlowMapper::toDto)
                .toList();
    }
}
