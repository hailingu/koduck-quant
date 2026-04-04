package com.koduck.service.impl;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.exception.ValidationException;
import com.koduck.mapper.MarketDataMapper;
import com.koduck.repository.market.MarketDailyNetFlowRepository;
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
                .orElseThrow(() -> new ResourceNotFoundException(
                        ErrorCode.MARKET_DATA_NOT_FOUND, "latest daily net flow", market + "/" + flowType));
    }
    @Override
    @Transactional(readOnly = true)
    public DailyNetFlowDto getDailyNetFlow(String market, String flowType, LocalDate tradeDate) {
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDate(market, flowType, tradeDate)
                .map(marketDataMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException(
                        ErrorCode.MARKET_DATA_NOT_FOUND, "daily net flow", market + "/" + flowType + "/" + tradeDate));
    }
    @Override
    @Transactional(readOnly = true)
    public List<DailyNetFlowDto> getDailyNetFlowHistory(String market, String flowType, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new ValidationException("结束日期不能早于开始日期");
        }
        return marketDailyNetFlowRepository
                .findByMarketAndFlowTypeAndTradeDateBetweenOrderByTradeDateAsc(market, flowType, from, to)
                .stream()
                .map(marketDataMapper::toDto)
                .toList();
    }
}
