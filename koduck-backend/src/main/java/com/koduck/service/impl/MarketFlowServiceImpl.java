package com.koduck.service.impl;

import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.entity.MarketDailyNetFlow;
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

    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getLatestDailyNetFlow(String market, String flowType) {
        return marketDailyNetFlowRepository
                .findFirstByMarketAndFlowTypeOrderByTradeDateDesc(market, flowType)
                .map(this::toDto)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getDailyNetFlow(String market, String flowType, LocalDate tradeDate) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDate(market, flowType, tradeDate)
                .map(this::toDto)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DailyNetFlowDto> getDailyNetFlowHistory(String market, String flowType, LocalDate from, LocalDate to) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDateBetweenOrderByTradeDateAsc(market, flowType, from, to)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private DailyNetFlowDto toDto(MarketDailyNetFlow entity) {
        return new DailyNetFlowDto(
                entity.getMarket(),
                entity.getFlowType(),
                entity.getTradeDate(),
                entity.getNetInflow(),
                entity.getTotalInflow(),
                entity.getTotalOutflow(),
                entity.getCurrency(),
                entity.getSource(),
                entity.getQuality(),
                entity.getSnapshotTime(),
                entity.getUpdatedAt()
        );
    }
}
