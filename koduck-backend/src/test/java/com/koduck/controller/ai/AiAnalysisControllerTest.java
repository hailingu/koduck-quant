package com.koduck.controller.ai;
import com.koduck.controller.ai.AiAnalysisController;

import java.util.List;
import java.util.Objects;
import java.util.Set;

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

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.ai.BacktestInterpretRequest;
import com.koduck.dto.ai.BacktestInterpretResponse;
import com.koduck.dto.ai.RiskAssessmentRequest;
import com.koduck.dto.ai.RiskAssessmentResponse;
import com.koduck.dto.ai.StockAnalysisRequest;
import com.koduck.dto.ai.StockAnalysisResponse;
import com.koduck.dto.ai.StrategyRecommendRequest;
import com.koduck.dto.ai.StrategyRecommendResponse;
import com.koduck.entity.auth.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.AiAnalysisService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AiAnalysisController}.
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
class AiAnalysisControllerTest {

    /**
     * Error message for null user principal.
     */
    private static final String USER_PRINCIPAL_REQUIRED_MESSAGE =
            "userPrincipal must not be null";

    /**
     * Error message for null controller.
     */
    private static final String CONTROLLER_REQUIRED_MESSAGE =
            "aiAnalysisController must not be null";

    /**
     * Test user ID for stock analysis tests.
     */
    private static final Long TEST_USER_ID_1 = 1001L;

    /**
     * Test user ID for strategy recommendation tests.
     */
    private static final Long TEST_USER_ID_2 = 1002L;

    /**
     * Test user ID for backtest interpretation tests.
     */
    private static final Long TEST_USER_ID_3 = 1003L;

    /**
     * Test user ID for risk assessment tests.
     */
    private static final Long TEST_USER_ID_4 = 1004L;

    /**
     * Test stock symbol.
     */
    private static final String TEST_SYMBOL = "AAPL";

    /**
     * Test market code.
     */
    private static final String TEST_MARKET = "US";

    /**
     * Test analysis type.
     */
    private static final String TEST_ANALYSIS_TYPE = "technical";

    /**
     * Test overall score for stock analysis.
     */
    private static final int TEST_OVERALL_SCORE = 80;

    /**
     * Test risk preference.
     */
    private static final String TEST_RISK_PREFERENCE = "moderate";

    /**
     * Test investment horizon.
     */
    private static final String TEST_INVESTMENT_HORIZON = "medium";

    /**
     * Test backtest result ID.
     */
    private static final Long TEST_BACKTEST_RESULT_ID = 11L;

    /**
     * Test portfolio ID.
     */
    private static final Long TEST_PORTFOLIO_ID = 22L;

    /**
     * Test username.
     */
    private static final String TEST_USERNAME = "demo";

    /**
     * Test email address.
     */
    private static final String TEST_EMAIL = "demo@koduck.dev";

    /**
     * Test password hash.
     */
    private static final String TEST_PASSWORD_HASH =
            "$2a$10$abcdefghijklmnopqrstuv";

    /**
     * User authority role.
     */
    private static final String USER_AUTHORITY_ROLE = "ROLE_USER";

    /**
     * Stock code blank error message.
     */
    private static final String STOCK_CODE_BLANK_MESSAGE = "股票代码不能为空";

    /**
     * Mock service for AI analysis.
     */
    @Mock
    private AiAnalysisService aiAnalysisService;

    /**
     * Controller under test.
     */
    @InjectMocks
    private AiAnalysisController aiAnalysisController;

    /**
     * Validator factory for bean validation tests.
     */
    private final ValidatorFactory validatorFactory =
            Validation.buildDefaultValidatorFactory();

    /**
     * Validator for bean validation tests.
     */
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
        ReflectionTestUtils.setField(
                Objects.requireNonNull(
                        aiAnalysisController, CONTROLLER_REQUIRED_MESSAGE),
                "authenticatedUserResolver",
                new AuthenticatedUserResolver());
    }

    /**
     * Verifies stock analysis delegates to service and returns
     * wrapped success response.
     */
    @Test
    @DisplayName("shouldAnalyzeStockWhenRequestIsValid")
    void shouldAnalyzeStockWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(TEST_USER_ID_1);
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL)
                .market(TEST_MARKET)
                .analysisType(TEST_ANALYSIS_TYPE)
                .build();
        StockAnalysisResponse serviceResponse = StockAnalysisResponse.builder()
                .symbol(TEST_SYMBOL)
                .overallScore(TEST_OVERALL_SCORE)
                .build();

        when(aiAnalysisService.analyzeStock(TEST_USER_ID_1, request))
                .thenReturn(serviceResponse);

        ApiResponse<StockAnalysisResponse> response =
                aiAnalysisController.analyzeStock(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals(TEST_SYMBOL, response.getData().getSymbol());
        verify(aiAnalysisService).analyzeStock(TEST_USER_ID_1, request);
    }

    /**
     * Verifies null authenticated principal is rejected.
     */
    @Test
    @DisplayName("shouldThrowExceptionWhenUserPrincipalIsNull")
    void shouldThrowExceptionWhenUserPrincipalIsNull() {
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL)
                .market(TEST_MARKET)
                .analysisType(TEST_ANALYSIS_TYPE)
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
        UserPrincipal userPrincipal = buildUserPrincipal(TEST_USER_ID_2);
        StrategyRecommendRequest request = StrategyRecommendRequest.builder()
                .riskPreference(TEST_RISK_PREFERENCE)
                .investmentHorizon(TEST_INVESTMENT_HORIZON)
                .build();
        StrategyRecommendResponse serviceResponse =
                StrategyRecommendResponse.builder()
                        .riskProfile(TEST_RISK_PREFERENCE)
                        .build();

        when(aiAnalysisService.recommendStrategies(TEST_USER_ID_2, request))
                .thenReturn(serviceResponse);

        ApiResponse<StrategyRecommendResponse> response =
                aiAnalysisController.recommendStrategies(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals(TEST_RISK_PREFERENCE, response.getData().getRiskProfile());
        verify(aiAnalysisService).recommendStrategies(TEST_USER_ID_2, request);
    }

    /**
     * Verifies backtest interpretation endpoint delegates correctly.
     */
    @Test
    @DisplayName("shouldInterpretBacktestWhenRequestIsValid")
    void shouldInterpretBacktestWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(TEST_USER_ID_3);
        BacktestInterpretRequest request = BacktestInterpretRequest.builder()
                .backtestResultId(TEST_BACKTEST_RESULT_ID)
                .build();
        BacktestInterpretResponse serviceResponse =
                BacktestInterpretResponse.builder()
                        .backtestResultId(TEST_BACKTEST_RESULT_ID)
                        .build();

        when(aiAnalysisService.interpretBacktest(
                TEST_USER_ID_3, TEST_BACKTEST_RESULT_ID))
                .thenReturn(serviceResponse);

        ApiResponse<BacktestInterpretResponse> response =
                aiAnalysisController.interpretBacktest(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals(TEST_BACKTEST_RESULT_ID,
                response.getData().getBacktestResultId());
        verify(aiAnalysisService).interpretBacktest(
                TEST_USER_ID_3, TEST_BACKTEST_RESULT_ID);
    }

    /**
     * Verifies risk assessment endpoint delegates correctly.
     */
    @Test
    @DisplayName("shouldAssessRiskWhenRequestIsValid")
    void shouldAssessRiskWhenRequestIsValid() {
        UserPrincipal userPrincipal = buildUserPrincipal(TEST_USER_ID_4);
        RiskAssessmentRequest request = RiskAssessmentRequest.builder()
                .portfolioId(TEST_PORTFOLIO_ID)
                .build();
        RiskAssessmentResponse serviceResponse = RiskAssessmentResponse.builder()
                .portfolioId(TEST_PORTFOLIO_ID)
                .build();

        when(aiAnalysisService.assessRisk(TEST_USER_ID_4, TEST_PORTFOLIO_ID))
                .thenReturn(serviceResponse);

        ApiResponse<RiskAssessmentResponse> response =
                aiAnalysisController.assessRisk(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertEquals(TEST_PORTFOLIO_ID, response.getData().getPortfolioId());
        verify(aiAnalysisService).assessRisk(TEST_USER_ID_4, TEST_PORTFOLIO_ID);
    }

    /**
     * Verifies bean validation catches blank symbol request data.
     */
    @Test
    @DisplayName("shouldFailValidationWhenStockSymbolIsBlank")
    void shouldFailValidationWhenStockSymbolIsBlank() {
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("")
                .market(TEST_MARKET)
                .analysisType(TEST_ANALYSIS_TYPE)
                .build();

        Set<ConstraintViolation<StockAnalysisRequest>> violations =
                validator.validate(request);

        assertTrue(violations.stream()
                .anyMatch(violation -> STOCK_CODE_BLANK_MESSAGE.equals(
                        violation.getMessage())));
    }

    private UserPrincipal buildUserPrincipal(Long userId) {
        User user = User.builder()
                .id(userId)
                .username(TEST_USERNAME)
                .email(TEST_EMAIL)
                .passwordHash(TEST_PASSWORD_HASH)
                .status(User.UserStatus.ACTIVE)
                .build();
        return new UserPrincipal(user, List.of(
                new SimpleGrantedAuthority(USER_AUTHORITY_ROLE)));
    }
}
