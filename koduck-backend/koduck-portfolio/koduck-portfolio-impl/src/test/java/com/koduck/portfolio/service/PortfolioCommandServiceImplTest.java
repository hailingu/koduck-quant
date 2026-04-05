package com.koduck.portfolio.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.koduck.portfolio.entity.PortfolioPosition;
import com.koduck.portfolio.entity.Trade;
import com.koduck.portfolio.entity.TradeType;
import com.koduck.portfolio.repository.PortfolioPositionRepository;
import com.koduck.portfolio.repository.TradeRepository;
import com.koduck.portfolio.service.impl.PortfolioCommandServiceImpl;

/**
 * PortfolioCommandServiceImpl 单元测试。
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class PortfolioCommandServiceImplTest {

    @Mock
    private PortfolioPositionRepository positionRepository;

    @Mock
    private TradeRepository tradeRepository;

    @InjectMocks
    private PortfolioCommandServiceImpl commandService;

    private static final Long TEST_USER_ID = 1L;
    private static final Long TEST_POSITION_ID = 100L;
    private static final String TEST_MARKET = "US";
    private static final String TEST_SYMBOL = "AAPL";

    @Test
    @DisplayName("添加新持仓应创建持仓")
    void addPositionShouldCreateNewPosition() {
        when(positionRepository.findByUserIdAndMarketAndSymbol(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL))
                .thenReturn(Optional.empty());
        when(positionRepository.save(any(PortfolioPosition.class)))
                .thenReturn(createTestPosition());

        Long result = commandService.addPosition(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL,
                new BigDecimal("100"), new BigDecimal("140.00"));

        verify(positionRepository).save(any(PortfolioPosition.class));
    }

    @Test
    @DisplayName("添加持仓应更新现有持仓当已存在")
    void addPositionShouldUpdateExistingPosition() {
        PortfolioPosition existing = createTestPosition();

        when(positionRepository.findByUserIdAndMarketAndSymbol(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL))
                .thenReturn(Optional.of(existing));
        when(positionRepository.save(any(PortfolioPosition.class)))
                .thenReturn(existing);

        Long result = commandService.addPosition(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL,
                new BigDecimal("50"), new BigDecimal("150.00"));

        verify(positionRepository).save(any(PortfolioPosition.class));
    }

    @Test
    @DisplayName("更新持仓应返回true当持仓存在")
    void updatePositionShouldReturnTrueWhenExists() {
        PortfolioPosition existing = createTestPosition();

        when(positionRepository.findById(TEST_POSITION_ID))
                .thenReturn(Optional.of(existing));
        when(positionRepository.save(any(PortfolioPosition.class)))
                .thenReturn(existing);

        boolean result = commandService.updatePosition(
                TEST_POSITION_ID, new BigDecimal("150"), new BigDecimal("145.00"));

        assertTrue(result);
    }

    @Test
    @DisplayName("更新持仓应返回false当持仓不存在")
    void updatePositionShouldReturnFalseWhenNotExists() {
        when(positionRepository.findById(TEST_POSITION_ID))
                .thenReturn(Optional.empty());

        boolean result = commandService.updatePosition(
                TEST_POSITION_ID, new BigDecimal("150"), new BigDecimal("145.00"));

        assertFalse(result);
    }

    @Test
    @DisplayName("删除持仓应返回true当持仓存在")
    void deletePositionShouldReturnTrueWhenExists() {
        when(positionRepository.existsById(TEST_POSITION_ID))
                .thenReturn(true);

        boolean result = commandService.deletePosition(TEST_POSITION_ID);

        assertTrue(result);
    }

    @Test
    @DisplayName("删除持仓应返回false当持仓不存在")
    void deletePositionShouldReturnFalseWhenNotExists() {
        when(positionRepository.existsById(TEST_POSITION_ID))
                .thenReturn(false);

        boolean result = commandService.deletePosition(TEST_POSITION_ID);

        assertFalse(result);
    }

    @Test
    @DisplayName("记录买入交易应创建交易并更新持仓")
    void recordTradeBuyShouldCreateTradeAndUpdatePosition() {
        when(positionRepository.findByUserIdAndMarketAndSymbol(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL))
                .thenReturn(Optional.empty());
        when(tradeRepository.save(any(Trade.class)))
                .thenReturn(createTestTrade());
        when(positionRepository.save(any(PortfolioPosition.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Long result = commandService.recordTrade(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL,
                "BUY", new BigDecimal("10"),
                new BigDecimal("150.00"), "Test buy");

        verify(tradeRepository).save(any(Trade.class));
        verify(positionRepository).save(any(PortfolioPosition.class));
    }

    @Test
    @DisplayName("记录卖出交易应减少持仓")
    void recordTradeSellShouldReducePosition() {
        PortfolioPosition existing = createTestPosition();

        when(positionRepository.findByUserIdAndMarketAndSymbol(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL))
                .thenReturn(Optional.of(existing));
        when(tradeRepository.save(any(Trade.class)))
                .thenReturn(createTestTrade());
        when(positionRepository.save(any(PortfolioPosition.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Long result = commandService.recordTrade(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL,
                "SELL", new BigDecimal("30"),
                new BigDecimal("160.00"), "Test sell");

        // 持仓应从 100 减少到 70
        assertEquals(0, new BigDecimal("70").compareTo(existing.getQuantity()));
    }

    @Test
    @DisplayName("卖出全部持仓应删除持仓")
    void recordTradeSellAllShouldDeletePosition() {
        PortfolioPosition existing = createTestPosition();

        when(positionRepository.findByUserIdAndMarketAndSymbol(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL))
                .thenReturn(Optional.of(existing));
        when(tradeRepository.save(any(Trade.class)))
                .thenReturn(createTestTrade());

        Long result = commandService.recordTrade(
                TEST_USER_ID, TEST_MARKET, TEST_SYMBOL,
                "SELL", new BigDecimal("100"),
                new BigDecimal("160.00"), "Sell all");

        verify(positionRepository).delete(existing);
    }

    private PortfolioPosition createTestPosition() {
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(TEST_USER_ID)
                .market(TEST_MARKET)
                .symbol(TEST_SYMBOL)
                .name("Apple Inc.")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("140.00"))
                .build();
        // 使用反射设置 id
        try {
            java.lang.reflect.Field idField = PortfolioPosition.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(position, TEST_POSITION_ID);
        } catch (Exception e) {
            // ignore
        }
        return position;
    }

    private Trade createTestTrade() {
        Trade trade = Trade.builder()
                .userId(TEST_USER_ID)
                .market(TEST_MARKET)
                .symbol(TEST_SYMBOL)
                .tradeType(TradeType.BUY)
                .quantity(new BigDecimal("10"))
                .price(new BigDecimal("140.00"))
                .amount(new BigDecimal("1400.00"))
                .build();
        // 使用反射设置 id
        try {
            java.lang.reflect.Field idField = Trade.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(trade, 1L);
        } catch (Exception e) {
            // ignore
        }
        return trade;
    }
}
