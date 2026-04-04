package com.koduck.controller.portfolio;
import com.koduck.controller.portfolio.PortfolioController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import jakarta.validation.constraints.Positive;

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
import com.koduck.entity.auth.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.PortfolioService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PortfolioController}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class PortfolioControllerTest {

    /** Test user ID constant. */
    private static final Long USER_ID = 1001L;

    /** Test position ID constant. */
    private static final Long TEST_POSITION_ID = 10L;

    /** Test position ID for delete operation. */
    private static final Long DELETE_POSITION_ID = 11L;

    /** Test trade ID constant. */
    private static final Long TEST_TRADE_ID = 5L;

    /** Test trade ID for add operation. */
    private static final Long ADD_TRADE_ID = 8L;

    /** Mock portfolio service. */
    @Mock
    private PortfolioService portfolioService;

    /** Mock authenticated user resolver. */
    @Mock
    private AuthenticatedUserResolver authenticatedUserResolver;

    /** Controller under test. */
    @InjectMocks
    private PortfolioController portfolioController;

    /** Test user principal. */
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
    void getPositionsShouldReturnPositions() {
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
    void getPortfolioSummaryShouldReturnSummary() {
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
    void addPositionShouldReturnPosition() {
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
    void updatePositionShouldReturnUpdatedPosition() {
        Long positionId = TEST_POSITION_ID;
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
    void deletePositionShouldReturnSuccess() {
        Long positionId = DELETE_POSITION_ID;

        ApiResponse<Void> response = portfolioController.deletePosition(userPrincipal, positionId);

        assertEquals(0, response.getCode());
        assertNull(response.getData());
        verify(portfolioService).deletePosition(USER_ID, positionId);
    }

    @Test
    @DisplayName("Get trades should return trade list")
    void getTradesShouldReturnTrades() {
        TradeDto trade = TradeDto.builder()
                .id(TEST_TRADE_ID)
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
    void addTradeShouldReturnTrade() {
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
                .id(ADD_TRADE_ID)
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
        assertEquals(ADD_TRADE_ID, response.getData().id());
        verify(portfolioService).addTrade(USER_ID, request);
    }

    @Test
    @DisplayName("Controller should declare @Validated for method parameter validation")
    void controllerShouldDeclareValidatedAnnotation() {
        Validated validated = PortfolioController.class.getAnnotation(Validated.class);

        assertNotNull(validated);
    }

    @Test
    @DisplayName("Update and delete methods should declare positive id constraint")
    void idParametersShouldDeclarePositiveConstraint() throws NoSuchMethodException {
        java.lang.reflect.Method updateMethod = PortfolioController.class.getMethod(
                "updatePosition",
                UserPrincipal.class,
                Long.class,
                UpdatePositionRequest.class
        );
        java.lang.reflect.Method deleteMethod = PortfolioController.class.getMethod(
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
