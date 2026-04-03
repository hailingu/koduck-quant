package com.koduck.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Trade;
import com.koduck.entity.enums.TradeType;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.TradeRepository;
import com.koduck.trading.application.PortfolioServiceImpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PortfolioService}.
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class PortfolioServiceTest {

    /** Position ID for not found tests. */
    private static final long NOT_FOUND_POSITION_ID = 999L;

    /** Mock repository for positions. */
    @Mock
    private PortfolioPositionRepository positionRepository;

    /** Mock repository for trades. */
    @Mock
    private TradeRepository tradeRepository;

    /** Mock service for kline data. */
    @Mock
    private KlineService klineService;

    /** Service under test. */
    private PortfolioServiceImpl portfolioService;

    /**
     * Set up test fixtures.
     */
    @BeforeEach
    void setUp() {
        portfolioService = new PortfolioServiceImpl(
            positionRepository, tradeRepository, klineService);
    }

    @Test
    @DisplayName("shouldCalculateDailyPnlWhenPreviousClosePriceIsAvailable")
    void shouldCalculateDailyPnlWhenPreviousClosePriceIsAvailable() {
        // Given
        Long userId = 1L;
        PortfolioPosition position = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        BigDecimal currentPrice = new BigDecimal("1600.00");
        BigDecimal prevClosePrice = new BigDecimal("1550.00");

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position));
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(currentPrice));
        when(klineService.getPreviousClosePrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(prevClosePrice));

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        // Daily PnL = (1600 - 1550) * 100 = 5000
        assertThat(summary.dailyPnl()).isEqualByComparingTo(new BigDecimal("5000.00"));
        // Yesterday's market value = (1600 * 100) - 5000 = 155000
        // Daily PnL % = (5000 / 155000) * 100 = 3.2258...
        assertThat(summary.dailyPnlPercent()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("shouldReturnZeroDailyPnlWhenPreviousClosePriceIsNotAvailable")
    void shouldReturnZeroDailyPnlWhenPreviousClosePriceIsNotAvailable() {
        // Given
        Long userId = 1L;
        PortfolioPosition position = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        BigDecimal currentPrice = new BigDecimal("1600.00");

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position));
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(currentPrice));
        when(klineService.getPreviousClosePrice("AShare", "600519", "1D"))
                .thenReturn(Optional.empty());

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        assertThat(summary.dailyPnl()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.dailyPnlPercent()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("shouldCalculateNegativeDailyPnlWhenPriceDecreased")
    void shouldCalculateNegativeDailyPnlWhenPriceDecreased() {
        // Given
        Long userId = 1L;
        PortfolioPosition position = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        BigDecimal currentPrice = new BigDecimal("1500.00");
        BigDecimal prevClosePrice = new BigDecimal("1550.00");

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position));
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(currentPrice));
        when(klineService.getPreviousClosePrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(prevClosePrice));

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        // Daily PnL = (1500 - 1550) * 100 = -5000
        assertThat(summary.dailyPnl()).isEqualByComparingTo(new BigDecimal("-5000.00"));
        assertThat(summary.dailyPnlPercent()).isLessThan(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("shouldSumDailyPnlForMultiplePositions")
    void shouldSumDailyPnlForMultiplePositions() {
        // Given
        Long userId = 1L;
        PortfolioPosition position1 = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        PortfolioPosition position2 = PortfolioPosition.builder()
                .id(2L)
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("500"))
                .avgCost(new BigDecimal("12.00"))
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position1, position2));

        // Position 1: current 1600, prev 1550, quantity 100 -> PnL = 5000
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(new BigDecimal("1600.00")));
        when(klineService.getPreviousClosePrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(new BigDecimal("1550.00")));

        // Position 2: current 13, prev 12, quantity 500 -> PnL = 500
        when(klineService.getLatestPrice("AShare", "000001", "1D"))
                .thenReturn(Optional.of(new BigDecimal("13.00")));
        when(klineService.getPreviousClosePrice("AShare", "000001", "1D"))
                .thenReturn(Optional.of(new BigDecimal("12.00")));

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        // Total Daily PnL = 5000 + 500 = 5500
        assertThat(summary.dailyPnl()).isEqualByComparingTo(new BigDecimal("5500.00"));
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenUserHasNoPositions")
    void shouldReturnEmptyListWhenUserHasNoPositions() {
        // Given
        Long userId = 1L;
        when(positionRepository.findByUserId(userId)).thenReturn(List.of());

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        assertThat(summary.totalCost()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.totalMarketValue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.totalPnl()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.dailyPnl()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("shouldAddPositionSuccessfully")
    void shouldAddPositionSuccessfully() {
        // Given
        Long userId = 1L;
        AddPositionRequest request = new AddPositionRequest(
                "AShare", "600519", "贵州茅台",
                new BigDecimal("100"), new BigDecimal("1500.00"));

        PortfolioPosition savedPosition = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        when(positionRepository.findByUserIdAndMarketAndSymbol(userId, "AShare", "600519"))
                .thenReturn(Optional.empty());
        when(positionRepository.save(org.mockito.ArgumentMatchers.any(PortfolioPosition.class)))
                .thenReturn(savedPosition);
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(new BigDecimal("1600.00")));

        // When
        PortfolioPositionDto result = portfolioService.addPosition(userId, request);

        // Then
        assertThat(result.symbol()).isEqualTo("600519");
        assertThat(result.quantity()).isEqualByComparingTo(new BigDecimal("100"));
    }

    @Test
    @DisplayName("shouldCalculateCorrectPnlPercentForSinglePosition")
    void shouldCalculateCorrectPnlPercentForSinglePosition() {
        // Given
        Long userId = 1L;
        PortfolioPosition position = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        BigDecimal currentPrice = new BigDecimal("1600.00");
        BigDecimal prevClosePrice = new BigDecimal("1550.00");

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position));
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(currentPrice));
        when(klineService.getPreviousClosePrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(prevClosePrice));

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        // Market Value = 1600 * 100 = 160000
        // Yesterday's MV = 1550 * 100 = 155000
        // Daily PnL = 5000
        // Daily PnL % = (5000 / 155000) * 100 = 3.2258
        assertThat(summary.dailyPnlPercent())
                .isEqualByComparingTo(new BigDecimal("3.2258"));
    }

    // ==================== Additional Exception Path Tests ====================

    @Test
    @DisplayName("shouldUpdateExistingPositionWhenAddingDuplicateSymbol")
    void shouldUpdateExistingPositionWhenAddingDuplicateSymbol() {
        // Given
        Long userId = 1L;
        AddPositionRequest request = new AddPositionRequest(
                "AShare", "600519", "贵州茅台",
                new BigDecimal("50"), new BigDecimal("1600.00"));

        PortfolioPosition existingPosition = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        PortfolioPosition updatedPosition = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("150"))
                .avgCost(new BigDecimal("1533.3333"))
                .build();

        when(positionRepository.findByUserIdAndMarketAndSymbol(userId, "AShare", "600519"))
                .thenReturn(Optional.of(existingPosition));
        when(positionRepository.save(any(PortfolioPosition.class)))
                .thenReturn(updatedPosition);
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(new BigDecimal("1600.00")));

        // When
        PortfolioPositionDto result = portfolioService.addPosition(userId, request);

        // Then
        assertThat(result.symbol()).isEqualTo("600519");
        assertThat(result.quantity()).isEqualByComparingTo(new BigDecimal("150"));
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenPositionNotFoundForUpdate")
    void shouldThrowExceptionWhenPositionNotFoundForUpdate() {
        // Given
        Long userId = 1L;
        Long positionId = NOT_FOUND_POSITION_ID;
        UpdatePositionRequest request = new UpdatePositionRequest(
                new BigDecimal("200"), new BigDecimal("1550.00"));

        when(positionRepository.findById(positionId)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> portfolioService.updatePosition(userId, positionId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Position not found");
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenUnauthorizedUserTriesToUpdate")
    void shouldThrowExceptionWhenUnauthorizedUserTriesToUpdate() {
        // Given
        Long userId = 1L;
        Long wrongUserId = 2L;
        Long positionId = 1L;
        UpdatePositionRequest request = new UpdatePositionRequest(
                new BigDecimal("200"), new BigDecimal("1550.00"));

        PortfolioPosition existingPosition = PortfolioPosition.builder()
                .id(positionId)
                .userId(wrongUserId)
                .market("AShare")
                .symbol("600519")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        when(positionRepository.findById(positionId)).thenReturn(Optional.of(existingPosition));

        // When & Then
        assertThatThrownBy(() -> portfolioService.updatePosition(userId, positionId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Not authorized");
    }

    @Test
    @DisplayName("shouldDeletePositionSuccessfully")
    void shouldDeletePositionSuccessfully() {
        // Given
        Long userId = 1L;
        Long positionId = 1L;

        // When
        portfolioService.deletePosition(userId, positionId);

        // Then
        verify(positionRepository).deleteByUserIdAndId(userId, positionId);
    }

    @Test
    @DisplayName("shouldUseFallbackPriceWhenCurrentPriceNotAvailable")
    void shouldUseFallbackPriceWhenCurrentPriceNotAvailable() {
        // Given
        Long userId = 1L;
        PortfolioPosition position = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position));
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.empty());
        when(klineService.getPreviousClosePrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(new BigDecimal("1550.00")));

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        assertThat(summary.totalCost()).isEqualByComparingTo(new BigDecimal("150000.00"));
        assertThat(summary.totalMarketValue()).isEqualByComparingTo(new BigDecimal("150000.00"));
    }

    @Test
    @DisplayName("shouldReturnZeroPnlPercentWhenTotalCostIsZero")
    void shouldReturnZeroPnlPercentWhenTotalCostIsZero() {
        // Given
        Long userId = 1L;
        PortfolioPosition position = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(BigDecimal.ZERO)
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(List.of(position));
        when(klineService.getLatestPrice("AShare", "600519", "1D"))
                .thenReturn(Optional.of(new BigDecimal("1600.00")));

        // When
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);

        // Then
        assertThat(summary.totalPnlPercent()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("shouldReturnEmptyPositionsListWhenUserHasNoPositions")
    void shouldReturnEmptyPositionsListWhenUserHasNoPositions() {
        // Given
        Long userId = 1L;
        when(positionRepository.findByUserId(userId)).thenReturn(Collections.emptyList());

        // When
        List<PortfolioPositionDto> positions = portfolioService.getPositions(userId);

        // Then
        assertThat(positions).isEmpty();
    }

    @Test
    @DisplayName("shouldAddBuyTradeAndUpdatePosition")
    void shouldAddBuyTradeAndUpdatePosition() {
        // Given
        Long userId = 1L;
        AddTradeRequest request = new AddTradeRequest(
                "AShare", "600519", "贵州茅台", "BUY",
                new BigDecimal("50"), new BigDecimal("1600.00"), LocalDateTime.now());

        Trade savedTrade = Trade.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .tradeType(TradeType.BUY)
                .quantity(new BigDecimal("50"))
                .price(new BigDecimal("1600.00"))
                .amount(new BigDecimal("80000.00"))
                .build();

        PortfolioPosition existingPosition = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        when(tradeRepository.save(any(Trade.class))).thenReturn(savedTrade);
        when(positionRepository.findByUserIdAndMarketAndSymbol(userId, "AShare", "600519"))
                .thenReturn(Optional.of(existingPosition));
        when(positionRepository.save(any(PortfolioPosition.class))).thenReturn(existingPosition);

        // When
        TradeDto result = portfolioService.addTrade(userId, request);

        // Then
        assertThat(result.symbol()).isEqualTo("600519");
        assertThat(result.tradeType()).isEqualTo("BUY");
    }

    @Test
    @DisplayName("shouldAddSellTradeAndReducePosition")
    void shouldAddSellTradeAndReducePosition() {
        // Given
        Long userId = 1L;
        AddTradeRequest request = new AddTradeRequest(
                "AShare", "600519", "贵州茅台", "SELL",
                new BigDecimal("30"), new BigDecimal("1650.00"), LocalDateTime.now());

        Trade savedTrade = Trade.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .tradeType(TradeType.SELL)
                .quantity(new BigDecimal("30"))
                .price(new BigDecimal("1650.00"))
                .amount(new BigDecimal("49500.00"))
                .build();

        PortfolioPosition existingPosition = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        when(tradeRepository.save(any(Trade.class))).thenReturn(savedTrade);
        when(positionRepository.findByUserIdAndMarketAndSymbol(userId, "AShare", "600519"))
                .thenReturn(Optional.of(existingPosition));
        when(positionRepository.save(any(PortfolioPosition.class))).thenReturn(existingPosition);

        // When
        TradeDto result = portfolioService.addTrade(userId, request);

        // Then
        assertThat(result.symbol()).isEqualTo("600519");
        assertThat(result.tradeType()).isEqualTo("SELL");
    }

    @Test
    @DisplayName("shouldDeletePositionWhenSellTradeFullyClosesPosition")
    void shouldDeletePositionWhenSellTradeFullyClosesPosition() {
        // Given
        Long userId = 1L;
        AddTradeRequest request = new AddTradeRequest(
                "AShare", "600519", "贵州茅台", "SELL",
                new BigDecimal("100"), new BigDecimal("1650.00"), LocalDateTime.now());

        Trade savedTrade = Trade.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .tradeType(TradeType.SELL)
                .quantity(new BigDecimal("100"))
                .price(new BigDecimal("1650.00"))
                .amount(new BigDecimal("165000.00"))
                .build();

        PortfolioPosition existingPosition = PortfolioPosition.builder()
                .id(1L)
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();

        when(tradeRepository.save(any(Trade.class))).thenReturn(savedTrade);
        when(positionRepository.findByUserIdAndMarketAndSymbol(userId, "AShare", "600519"))
                .thenReturn(Optional.of(existingPosition));

        // When
        TradeDto result = portfolioService.addTrade(userId, request);

        // Then
        assertThat(result.symbol()).isEqualTo("600519");
        verify(positionRepository).delete(existingPosition);
    }

    @Test
    @DisplayName("shouldReturnEmptyTradesListWhenUserHasNoTrades")
    void shouldReturnEmptyTradesListWhenUserHasNoTrades() {
        // Given
        Long userId = 1L;
        when(tradeRepository.findByUserIdOrderByTradeTimeDesc(userId))
            .thenReturn(Collections.emptyList());

        // When
        List<TradeDto> trades = portfolioService.getTrades(userId);

        // Then
        assertThat(trades).isEmpty();
    }
}
