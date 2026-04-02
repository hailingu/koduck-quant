package com.koduck.market.application;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.market.DailyBreadthDto;
import com.koduck.mapper.MarketDataMapper;
import com.koduck.repository.MarketDailyBreadthRepository;
import com.koduck.service.MarketBreadthService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MarketBreadthServiceImpl implements MarketBreadthService {
    private final MarketDailyBreadthRepository marketDailyBreadthRepository;
    private final MarketDataMapper marketDataMapper;
    @Override
    @Transactional(readOnly = true)
    public DailyBreadthDto getLatestDailyBreadth(String market, String breadthType) {
        return marketDailyBreadthRepository
                .findFirstByMarketAndBreadthTypeOrderByTradeDateDesc(market, breadthType)
            .map(marketDataMapper::toDto)
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public DailyBreadthDto getDailyBreadth(String market, String breadthType, LocalDate tradeDate) {
        return marketDailyBreadthRepository
                .findByMarketAndBreadthTypeAndTradeDate(market, breadthType, tradeDate)
            .map(marketDataMapper::toDto)
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public List<DailyBreadthDto> getDailyBreadthHistory(String market, String breadthType, LocalDate from, LocalDate to) {
        return marketDailyBreadthRepository
                .findByMarketAndBreadthTypeAndTradeDateBetweenOrderByTradeDateAsc(market, breadthType, from, to)
                .stream()
            .map(marketDataMapper::toDto)
                .toList();
    }
}
