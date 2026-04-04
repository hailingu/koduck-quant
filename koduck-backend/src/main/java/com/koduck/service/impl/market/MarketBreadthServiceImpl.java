package com.koduck.service.impl.market;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.market.DailyBreadthDto;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.exception.ValidationException;
import com.koduck.mapper.MarketDataMapper;
import com.koduck.repository.market.MarketDailyBreadthRepository;
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
                .orElseThrow(() -> new ResourceNotFoundException(
                        ErrorCode.MARKET_DATA_NOT_FOUND, "latest daily breadth", market + "/" + breadthType));
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
        if (to.isBefore(from)) {
            throw new ValidationException("结束日期不能早于开始日期");
        }
        return marketDailyBreadthRepository
            .findByMarketAndBreadthTypeAndTradeDateBetweenOrderByTradeDateAsc(market, breadthType, from, to)
            .stream()
            .map(marketDataMapper::toDto)
            .toList();
    }
}
