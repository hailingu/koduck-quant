package com.koduck.portfolio.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.koduck.common.constants.MarketConstants;
import com.koduck.portfolio.dto.PortfolioPositionDto;
import com.koduck.portfolio.dto.PortfolioSummaryDto;
import com.koduck.portfolio.dto.TradeDto;
import com.koduck.portfolio.entity.PortfolioPosition;
import com.koduck.portfolio.entity.Trade;
import com.koduck.portfolio.entity.TradeType;
import com.koduck.portfolio.repository.PortfolioPositionRepository;
import com.koduck.portfolio.repository.TradeRepository;
import com.koduck.portfolio.service.impl.PortfolioQueryServiceImpl;

/**
 * PortfolioQueryServiceImpl 单元测试。
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class PortfolioQueryServiceImplTest {

    @Mock
    private PortfolioPositionRepository positionRepository;

    @Mock
    private TradeRepository tradeRepository;

    @Mock
    private PortfolioPriceService priceService;

    @InjectMocks
    private PortfolioQueryServiceImpl queryService;

    private static final Long TEST_USER_ID = 1L;
    private static final Long TEST_POSITION_ID = 100L;
    private static final String TEST_MARKET = "US";
    private static final String TEST_SYMBOL = "AAPL";

    @BeforeEach
    void setUp() {
        // MockitoExtension handles initialization
    }

    @Test
    @DisplayName("获取持仓列表应返回空列表当用户无持仓")
    void getPositionsShouldReturnEmptyListWhenNoPositions() {
        when(positionRepository.findByUserId(TEST_USER_ID))
                .thenReturn(Collections.emptyList());

        List<PortfolioPositionDto> result = queryService.getPositions(TEST_USER_ID);

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("获取持仓列表应返回持仓信息")
    void getPositionsShouldReturnPositions() {
        PortfolioPosition position = createTestPosition();
        when(positionRepository.findByUserId(TEST_USER_ID))
                .thenReturn(List.of(position));
        when(priceService.getLatestPrice(anyString(), anyString(), any()))
                .thenReturn(Optional.of(new BigDecimal("150.00")));

        List<PortfolioPositionDto> result = queryService.getPositions(TEST_USER_ID);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(TEST_SYMBOL, result.get(0).symbol());
    }

    @Test
    @DisplayName("获取投资组合汇总应返回空当无持仓")
    void getPortfolioSummaryShouldReturnEmptyWhenNoPositions() {
        when(positionRepository.findByUserId(TEST_USER_ID))
                .thenReturn(Collections.emptyList());

        Optional<PortfolioSummaryDto> result = queryService.getPortfolioSummary(TEST_USER_ID);

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("获取投资组合汇总应返回汇总信息")
    void getPortfolioSummaryShouldReturnSummary() {
        PortfolioPosition position = createTestPosition();
        when(positionRepository.findByUserId(TEST_USER_ID))
                .thenReturn(List.of(position));
        when(priceService.getLatestPrice(anyString(), anyString(), any()))
                .thenReturn(Optional.of(new BigDecimal("150.00")));
        when(priceService.getPreviousClosePrice(anyString(), anyString(), any()))
                .thenReturn(Optional.of(new BigDecimal("145.00")));

        Optional<PortfolioSummaryDto> result = queryService.getPortfolioSummary(TEST_USER_ID);

        assertTrue(result.isPresent());
        assertNotNull(result.get().totalCost());
        assertNotNull(result.get().totalMarketValue());
    }

    @Test
    @DisplayName("获取单个持仓应返回空当持仓不存在")
    void getPositionShouldReturnEmptyWhenNotFound() {
        when(positionRepository.findById(TEST_POSITION_ID))
                .thenReturn(Optional.empty());

        Optional<PortfolioPositionDto> result = queryService.getPosition(TEST_POSITION_ID);

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("获取交易记录应返回空列表当无交易")
    void getTradesShouldReturnEmptyListWhenNoTrades() {
        when(tradeRepository.findByUserIdOrderByTradeTimeDesc(TEST_USER_ID))
                .thenReturn(Collections.emptyList());

        List<TradeDto> result = queryService.getTrades(TEST_USER_ID, 1, 10);

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("分页获取交易记录应正确分页")
    void getTradesShouldPaginateCorrectly() {
        List<Trade> trades = List.of(
                createTestTrade(1L),
                createTestTrade(2L),
                createTestTrade(3L)
        );
        when(tradeRepository.findByUserIdOrderByTradeTimeDesc(TEST_USER_ID))
                .thenReturn(trades);

        List<TradeDto> result = queryService.getTrades(TEST_USER_ID, 1, 2);

        assertEquals(2, result.size());
    }

    private PortfolioPosition createTestPosition() {
        return PortfolioPosition.builder()
                .id(TEST_POSITION_ID)
                .userId(TEST_USER_ID)
                .market(TEST_MARKET)
                .symbol(TEST_SYMBOL)
                .name("Apple Inc.")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("140.00"))
                .build();
    }

    private Trade createTestTrade(Long id) {
        return Trade.builder()
                .id(id)
                .userId(TEST_USER_ID)
                .market(TEST_MARKET)
                .symbol(TEST_SYMBOL)
                .tradeType(TradeType.BUY)
                .quantity(new BigDecimal("10"))
                .price(new BigDecimal("140.00"))
                .amount(new BigDecimal("1400.00"))
                .build();
    }
}
