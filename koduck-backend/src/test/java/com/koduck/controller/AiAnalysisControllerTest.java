package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.ai.BacktestInterpretRequest;
import com.koduck.dto.ai.BacktestInterpretResponse;
import com.koduck.dto.ai.RiskAssessmentRequest;
import com.koduck.dto.ai.RiskAssessmentResponse;
import com.koduck.dto.ai.StockAnalysisRequest;
import com.koduck.dto.ai.StockAnalysisResponse;
import com.koduck.dto.ai.StrategyRecommendRequest;
import com.koduck.dto.ai.StrategyRecommendResponse;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.entity.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.AiAnalysisService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AiAnalysisController}.
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AiAnalysisControllerTest {

        private static final String USER_PRINCIPAL_REQUIRED_MESSAGE = "userPrincipal must not be null";

    @Mock
    private AiAnalysisService aiAnalysisService;

    @InjectMocks
    private AiAnalysisController aiAnalysisController;

    private final ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory();
    private final Validator validator = validatorFactory.getValidator();

    /**
     * Closes validator resources after all test assertions.
     */
    @AfterEach
    void tearDown() {
        validatorFactory.close();
    }

        @BeforeEach
        void setUp() {
                ReflectionTestUtils.setField(aiAnalysisController, "authenticatedUserResolver", new AuthenticatedUserResolver());
        }

    /**
     * Verifies stock analysis delegates to service and returns wrapped success response.
     */
    @Test
    @DisplayName("shouldAnalyzeStockWhenRequestIsValid")
    void shouldAnalyzeStockWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(1001L);
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("AAPL")
                .market("US")
                .analysisType("technical")
                .build();
        StockAnalysisResponse serviceResponse = StockAnalysisResponse.builder()
                .symbol("AAPL")
                .overallScore(80)
                .build();

        when(aiAnalysisService.analyzeStock(1001L, request)).thenReturn(serviceResponse);

        ApiResponse<StockAnalysisResponse> response = aiAnalysisController.analyzeStock(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals("AAPL", response.getData().getSymbol());
        verify(aiAnalysisService).analyzeStock(1001L, request);
    }

    /**
     * Verifies null authenticated principal is rejected.
     */
    @Test
    @DisplayName("shouldThrowExceptionWhenUserPrincipalIsNull")
    void shouldThrowExceptionWhenUserPrincipalIsNull() {
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("AAPL")
                .market("US")
                .analysisType("technical")
                .build();

        NullPointerException exception = assertThrows(
                NullPointerException.class,
                () -> aiAnalysisController.analyzeStock(null, request)
        );

                assertEquals(USER_PRINCIPAL_REQUIRED_MESSAGE, exception.getMessage());
    }

    /**
     * Verifies strategy recommendation endpoint delegates correctly.
     */
    @Test
    @DisplayName("shouldRecommendStrategiesWhenRequestIsValid")
    void shouldRecommendStrategiesWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(1002L);
        StrategyRecommendRequest request = StrategyRecommendRequest.builder()
                .riskPreference("moderate")
                .investmentHorizon("medium")
                .build();
        StrategyRecommendResponse serviceResponse = StrategyRecommendResponse.builder()
                .riskProfile("moderate")
                .build();

        when(aiAnalysisService.recommendStrategies(1002L, request)).thenReturn(serviceResponse);

        ApiResponse<StrategyRecommendResponse> response = aiAnalysisController.recommendStrategies(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals("moderate", response.getData().getRiskProfile());
        verify(aiAnalysisService).recommendStrategies(1002L, request);
    }

    /**
     * Verifies backtest interpretation endpoint delegates correctly.
     */
    @Test
    @DisplayName("shouldInterpretBacktestWhenRequestIsValid")
    void shouldInterpretBacktestWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(1003L);
        BacktestInterpretRequest request = BacktestInterpretRequest.builder()
                .backtestResultId(11L)
                .build();
        BacktestInterpretResponse serviceResponse = BacktestInterpretResponse.builder()
                .backtestResultId(11L)
                .build();

        when(aiAnalysisService.interpretBacktest(1003L, 11L)).thenReturn(serviceResponse);

        ApiResponse<BacktestInterpretResponse> response = aiAnalysisController.interpretBacktest(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals(11L, response.getData().getBacktestResultId());
        verify(aiAnalysisService).interpretBacktest(1003L, 11L);
    }

    /**
     * Verifies risk assessment endpoint delegates correctly.
     */
    @Test
    @DisplayName("shouldAssessRiskWhenRequestIsValid")
    void shouldAssessRiskWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(1004L);
        RiskAssessmentRequest request = RiskAssessmentRequest.builder()
                .portfolioId(22L)
                .build();
        RiskAssessmentResponse serviceResponse = RiskAssessmentResponse.builder()
                .portfolioId(22L)
                .build();

        when(aiAnalysisService.assessRisk(1004L, 22L)).thenReturn(serviceResponse);

        ApiResponse<RiskAssessmentResponse> response = aiAnalysisController.assessRisk(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals(22L, response.getData().getPortfolioId());
        verify(aiAnalysisService).assessRisk(1004L, 22L);
    }

    /**
     * Verifies bean validation catches blank symbol request data.
     */
    @Test
    @DisplayName("shouldFailValidationWhenStockSymbolIsBlank")
    void shouldFailValidationWhenStockSymbolIsBlank() {
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("")
                .market("US")
                .analysisType("technical")
                .build();

        Set<ConstraintViolation<StockAnalysisRequest>> violations = validator.validate(request);

        assertTrue(violations.stream().anyMatch(violation -> "股票代码不能为空".equals(violation.getMessage())));
    }

    private UserPrincipal buildUserPrincipal(Long userId) {
        User user = User.builder()
                .id(userId)
                .username("demo")
                .email("demo@koduck.dev")
                .passwordHash("$2a$10$abcdefghijklmnopqrstuv")
                .status(User.UserStatus.ACTIVE)
                .build();
        return new UserPrincipal(user, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }
}
