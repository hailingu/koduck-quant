package com.koduck.service;

import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.entity.PortfolioPosition;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.TradeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PortfolioService}.
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class PortfolioServiceTest {

    @Mock
    private PortfolioPositionRepository positionRepository;

    @Mock
    private TradeRepository tradeRepository;

    @Mock
    private KlineService klineService;

    private PortfolioService portfolioService;

    @BeforeEach
    void setUp() {
        portfolioService = new PortfolioService(positionRepository, tradeRepository, klineService);
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
                "AShare", "600519", "贵州茅台", new BigDecimal("100"), new BigDecimal("1500.00"));

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
}
