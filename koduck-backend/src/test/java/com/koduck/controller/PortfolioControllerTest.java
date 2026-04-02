package com.koduck.controller;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.validation.annotation.Validated;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;
import com.koduck.entity.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.PortfolioService;

import jakarta.validation.constraints.Positive;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioControllerTest {

    private static final Long USER_ID = 1001L;

    @Mock
    private PortfolioService portfolioService;

        @Mock
        private AuthenticatedUserResolver authenticatedUserResolver;

    @InjectMocks
    private PortfolioController portfolioController;

    private UserPrincipal userPrincipal;

    @BeforeEach
    void setUp() {
        User user = User.builder()
                .id(USER_ID)
                .username("tester")
                .email("tester@example.com")
                .passwordHash("hashed")
                .status(User.UserStatus.ACTIVE)
                .build();
        userPrincipal = new UserPrincipal(user, Collections.emptyList());
        lenient().when(authenticatedUserResolver.requireUserId(any(UserPrincipal.class))).thenReturn(USER_ID);
    }

    @Test
    @DisplayName("Get positions should return data from service")
    void getPositions_shouldReturnPositions() {
        PortfolioPositionDto position = PortfolioPositionDto.builder()
                .id(1L)
                .market("AShare")
                .symbol("000001")
                .name("Ping An Bank")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("10.50"))
                .build();
        when(portfolioService.getPositions(USER_ID)).thenReturn(List.of(position));

        ApiResponse<List<PortfolioPositionDto>> response = portfolioController.getPositions(userPrincipal);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(1, response.getData().size());
        assertEquals("000001", response.getData().getFirst().symbol());
        verify(portfolioService).getPositions(USER_ID);
    }

    @Test
    @DisplayName("Get summary should return summary from service")
    void getPortfolioSummary_shouldReturnSummary() {
        PortfolioSummaryDto summary = PortfolioSummaryDto.builder()
                .totalCost(new BigDecimal("10000"))
                .totalMarketValue(new BigDecimal("11250"))
                .totalPnl(new BigDecimal("1250"))
                .totalPnlPercent(new BigDecimal("12.50"))
                .dailyPnl(new BigDecimal("80"))
                .dailyPnlPercent(new BigDecimal("0.72"))
                .build();
        when(portfolioService.getPortfolioSummary(USER_ID)).thenReturn(summary);

        ApiResponse<PortfolioSummaryDto> response = portfolioController.getPortfolioSummary(userPrincipal);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(new BigDecimal("11250"), response.getData().totalMarketValue());
        verify(portfolioService).getPortfolioSummary(USER_ID);
    }

    @Test
    @DisplayName("Add position should delegate to service")
    void addPosition_shouldReturnPosition() {
        AddPositionRequest request = new AddPositionRequest(
                "AShare",
                "600000",
                "PF Bank",
                new BigDecimal("200"),
                new BigDecimal("9.80")
        );
        PortfolioPositionDto position = PortfolioPositionDto.builder()
                .id(2L)
                .market("AShare")
                .symbol("600000")
                .name("PF Bank")
                .quantity(new BigDecimal("200"))
                .avgCost(new BigDecimal("9.80"))
                .build();
        when(portfolioService.addPosition(USER_ID, request)).thenReturn(position);

        ApiResponse<PortfolioPositionDto> response = portfolioController.addPosition(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(2L, response.getData().id());
        verify(portfolioService).addPosition(USER_ID, request);
    }

    @Test
    @DisplayName("Update position should delegate to service")
    void updatePosition_shouldReturnUpdatedPosition() {
        Long positionId = 10L;
        UpdatePositionRequest request = new UpdatePositionRequest(
                new BigDecimal("350"),
                new BigDecimal("11.25")
        );
        PortfolioPositionDto position = PortfolioPositionDto.builder()
                .id(positionId)
                .market("AShare")
                .symbol("300750")
                .name("CATL")
                .quantity(new BigDecimal("350"))
                .avgCost(new BigDecimal("11.25"))
                .build();
        when(portfolioService.updatePosition(USER_ID, positionId, request)).thenReturn(position);

        ApiResponse<PortfolioPositionDto> response = portfolioController.updatePosition(
                userPrincipal,
                positionId,
                request
        );

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(positionId, response.getData().id());
        verify(portfolioService).updatePosition(USER_ID, positionId, request);
    }

    @Test
    @DisplayName("Delete position should return empty success response")
    void deletePosition_shouldReturnSuccess() {
        Long positionId = 11L;

        ApiResponse<Void> response = portfolioController.deletePosition(userPrincipal, positionId);

        assertEquals(0, response.getCode());
        assertNull(response.getData());
        verify(portfolioService).deletePosition(USER_ID, positionId);
    }

    @Test
    @DisplayName("Get trades should return trade list")
    void getTrades_shouldReturnTrades() {
        TradeDto trade = TradeDto.builder()
                .id(5L)
                .market("AShare")
                .symbol("000001")
                .name("Ping An Bank")
                .tradeType("BUY")
                .quantity(new BigDecimal("100"))
                .price(new BigDecimal("10.25"))
                .amount(new BigDecimal("1025"))
                .tradeTime(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();
        when(portfolioService.getTrades(USER_ID)).thenReturn(List.of(trade));

        ApiResponse<List<TradeDto>> response = portfolioController.getTrades(userPrincipal);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(1, response.getData().size());
        assertEquals("BUY", response.getData().getFirst().tradeType());
        verify(portfolioService).getTrades(USER_ID);
    }

    @Test
    @DisplayName("Add trade should delegate to service")
    void addTrade_shouldReturnTrade() {
        AddTradeRequest request = new AddTradeRequest(
                "AShare",
                "002594",
                "BYD",
                "BUY",
                new BigDecimal("50"),
                new BigDecimal("205.5"),
                LocalDateTime.now()
        );
        TradeDto trade = TradeDto.builder()
                .id(8L)
                .market("AShare")
                .symbol("002594")
                .name("BYD")
                .tradeType("BUY")
                .quantity(new BigDecimal("50"))
                .price(new BigDecimal("205.5"))
                .amount(new BigDecimal("10275"))
                .tradeTime(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();
        when(portfolioService.addTrade(USER_ID, request)).thenReturn(trade);

        ApiResponse<TradeDto> response = portfolioController.addTrade(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(8L, response.getData().id());
        verify(portfolioService).addTrade(USER_ID, request);
    }

    @Test
    @DisplayName("Controller should declare @Validated for method parameter validation")
    void controller_shouldDeclareValidatedAnnotation() {
        Validated validated = PortfolioController.class.getAnnotation(Validated.class);

        assertNotNull(validated);
    }

    @Test
    @DisplayName("Update and delete methods should declare positive id constraint")
    void idParameters_shouldDeclarePositiveConstraint() throws NoSuchMethodException {
        Method updateMethod = PortfolioController.class.getMethod(
                "updatePosition",
                UserPrincipal.class,
                Long.class,
                UpdatePositionRequest.class
        );
        Method deleteMethod = PortfolioController.class.getMethod(
                "deletePosition",
                UserPrincipal.class,
                Long.class
        );

        Positive updateIdPositive = updateMethod.getParameters()[1].getAnnotation(Positive.class);
        Positive deleteIdPositive = deleteMethod.getParameters()[1].getAnnotation(Positive.class);

        assertNotNull(updateIdPositive);
        assertNotNull(deleteIdPositive);
    }
}
