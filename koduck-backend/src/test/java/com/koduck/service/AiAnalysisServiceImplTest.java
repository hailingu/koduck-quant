package com.koduck.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.config.AgentConfig;
import com.koduck.dto.ai.BacktestInterpretResponse;
import com.koduck.dto.ai.ChatMessageRequest;
import com.koduck.dto.ai.ChatStreamRequest;
import com.koduck.dto.ai.RiskAssessmentResponse;
import com.koduck.dto.ai.StockAnalysisRequest;
import com.koduck.dto.ai.StockAnalysisResponse;
import com.koduck.dto.ai.StrategyRecommendRequest;
import com.koduck.dto.ai.StrategyRecommendResponse;
import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.entity.BacktestResult;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Strategy;
import com.koduck.exception.ExternalServiceException;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.BacktestResultRepository;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.service.support.AiConversationSupport;
import com.koduck.service.support.AiRecommendationSupport;
import com.koduck.service.support.AiStreamRelaySupport;
import com.koduck.service.impl.AiAnalysisServiceImpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.BDDMockito.given;

/**
 * Unit tests for {@link AiAnalysisServiceImpl}.
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings({"unchecked", "null"})
class AiAnalysisServiceImplTest {

    /** Test user ID constant. */
    private static final Long TEST_USER_ID = 1L;

    /** Test stock symbol for Kweichow Moutai. */
    private static final String TEST_SYMBOL_MOUTAI = "600519";

    /** Test A-share market identifier. */
    private static final String TEST_MARKET_ASHARE = "AShare";

    /** Test stock name for Kweichow Moutai. */
    private static final String TEST_NAME_MOUTAI = "贵州茅台";

    /** Test stock price - Moutai. */
    private static final double TEST_PRICE_MOUTAI = 1500.0;

    /** Test change percentage. */
    private static final double TEST_CHANGE_PERCENT = 2.5;

    /** Test open price. */
    private static final double TEST_OPEN_PRICE = 1480.0;

    /** Test high price. */
    private static final double TEST_HIGH_PRICE = 1520.0;

    /** Test low price. */
    private static final double TEST_LOW_PRICE = 1470.0;

    /** Test previous close price. */
    private static final double TEST_PREV_CLOSE = 1460.0;

    /** Test trading volume. */
    private static final long TEST_VOLUME = 10000L;

    /** Default LLM provider. */
    private static final String DEFAULT_PROVIDER = "minimax";

    /** Deepseek provider. */
    private static final String PROVIDER_DEEPSEEK = "deepseek";

    /** OpenAI provider. */
    private static final String PROVIDER_OPENAI = "openai";

    /** Test API key. */
    private static final String TEST_API_KEY = "test-api-key";

    /** Test API base URL. */
    private static final String TEST_API_BASE = "http://test-api.com";

    /** Test agent URL. */
    private static final String TEST_AGENT_URL = "http://agent:8000";

    /** Test session ID. */
    private static final String TEST_SESSION_ID = "session-123";

    /** Test strategy ID 1. */
    private static final Long TEST_STRATEGY_ID_1 = 1L;

    /** Test strategy ID 2. */
    private static final Long TEST_STRATEGY_ID_2 = 2L;

    /** Test backtest result ID. */
    private static final Long TEST_BACKTEST_RESULT_ID = 100L;

    /** Test non-existent backtest result ID. */
    private static final Long TEST_BACKTEST_RESULT_ID_NONEXISTENT = 999L;

    /** Test portfolio ID. */
    private static final Long TEST_PORTFOLIO_ID = 10L;

    /** Test portfolio position ID 1. */
    private static final Long TEST_POSITION_ID_1 = 1L;

    /** Test portfolio position ID 2. */
    private static final Long TEST_POSITION_ID_2 = 2L;

    /** Test quantity for position 1. */
    private static final String TEST_QUANTITY_1 = "100";

    /** Test quantity for position 2. */
    private static final String TEST_QUANTITY_2 = "500";

    /** Test symbol for position 2. */
    private static final String TEST_SYMBOL_POSITION_2 = "000001";

    /** Test total return value. */
    private static final String TEST_TOTAL_RETURN = "0.15";

    /** Test risk score - medium high. */
    private static final int TEST_RISK_SCORE_HIGH = 65;

    /** Test risk score - medium. */
    private static final int TEST_RISK_SCORE_MEDIUM = 50;

    /** Mock repository for portfolio positions. */
    @Mock
    private PortfolioPositionRepository positionRepository;

    /** Mock repository for strategies. */
    @Mock
    private StrategyRepository strategyRepository;

    /** Mock repository for backtest results. */
    @Mock
    private BacktestResultRepository backtestResultRepository;

    /** Mock service for user settings. */
    @Mock
    private UserSettingsService userSettingsService;

    /** Mock configuration for agent. */
    @Mock
    private AgentConfig agentConfig;

    /** Mock builder for REST template. */
    @Mock
    private RestTemplateBuilder restTemplateBuilder;

    /** Mock REST template. */
    @Mock
    private RestTemplate restTemplate;

    /** Mock support for AI conversation. */
    @Mock
    private AiConversationSupport aiConversationSupport;

    /** Mock support for AI stream relay. */
    @Mock
    private AiStreamRelaySupport aiStreamRelaySupport;

    /** Mock support for AI recommendation. */
    @Mock
    private AiRecommendationSupport aiRecommendationSupport;

    /** Object mapper for JSON processing. */
    private ObjectMapper objectMapper;

    /** Service under test. */
    private AiAnalysisServiceImpl aiAnalysisService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        lenient().when(restTemplateBuilder.connectTimeout(any(Duration.class)))
                .thenReturn(restTemplateBuilder);
        lenient().when(restTemplateBuilder.readTimeout(any(Duration.class)))
                .thenReturn(restTemplateBuilder);
        lenient().when(restTemplateBuilder.build()).thenReturn(restTemplate);
        lenient().when(agentConfig.getUrl()).thenReturn(TEST_AGENT_URL);

        aiAnalysisService = new AiAnalysisServiceImpl(
                positionRepository,
                strategyRepository,
                backtestResultRepository,
                userSettingsService,
                agentConfig,
                objectMapper,
                restTemplateBuilder,
                aiConversationSupport,
                aiStreamRelaySupport,
                aiRecommendationSupport
        );
    }

    // ==================== analyzeStock Tests ====================

    @Test
    @DisplayName("shouldReturnAnalysisWhenAgentReturnsValidResponse")
    void shouldReturnAnalysisWhenAgentReturnsValidResponse() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .name(TEST_NAME_MOUTAI)
                .price(TEST_PRICE_MOUTAI)
                .analysisType("comprehensive")
                .question("分析这只股票")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .apiBase(TEST_API_BASE)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "这是一个买入信号")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("这是一个买入信号"))
                .thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getAnalysis()).isEqualTo("这是一个买入信号");
        assertThat(response.getSymbol()).isEqualTo(TEST_SYMBOL_MOUTAI);
        assertThat(response.getRecommendation()).isEqualTo("建议买入");
        assertThat(response.getProvider()).isEqualTo(DEFAULT_PROVIDER);
    }

    @Test
    @DisplayName("shouldUseDefaultProviderWhenProviderIsNull")
    void shouldUseDefaultProviderWhenProviderIsNull() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .provider(null)
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果"))
                .thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo(DEFAULT_PROVIDER);
    }

    @Test
    @DisplayName("shouldUseDeepseekProviderWhenSpecified")
    void shouldUseDeepseekProviderWhenSpecified() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .provider(PROVIDER_DEEPSEEK)
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "Deepseek分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, PROVIDER_DEEPSEEK)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("Deepseek分析结果"))
                .thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo(PROVIDER_DEEPSEEK);
    }

    @Test
    @DisplayName("shouldFallbackToMinimaxWhenUnsupportedProviderSpecified")
    void shouldFallbackToMinimaxWhenUnsupportedProviderSpecified() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .provider("unsupported")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果"))
                .thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo(DEFAULT_PROVIDER);
    }

    @Test
    @DisplayName("shouldThrowExternalServiceExceptionWhenAgentCallFails")
    void shouldThrowExternalServiceExceptionWhenAgentCallFails() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willThrow(new RuntimeException("Connection refused"));

        // When & Then
        assertThatThrownBy(() -> aiAnalysisService.analyzeStock(userId, request))
                .isInstanceOf(ExternalServiceException.class)
                .hasMessageContaining("AI 分析服务调用失败");
    }

    @Test
    @DisplayName("shouldThrowExternalServiceExceptionWhenAgentReturnsEmptyChoices")
    void shouldThrowExternalServiceExceptionWhenAgentReturnsEmptyChoices() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of("choices", Collections.emptyList());

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));

        // When & Then
        assertThatThrownBy(() -> aiAnalysisService.analyzeStock(userId, request))
                .isInstanceOf(ExternalServiceException.class)
                .hasMessageContaining("Invalid response from agent");
    }

    @Test
    @DisplayName("shouldBuildPromptWithAllFieldsWhenRequestHasAllData")
    void shouldBuildPromptWithAllFieldsWhenRequestHasAllData() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .name(TEST_NAME_MOUTAI)
                .price(TEST_PRICE_MOUTAI)
                .changePercent(TEST_CHANGE_PERCENT)
                .openPrice(TEST_OPEN_PRICE)
                .high(TEST_HIGH_PRICE)
                .low(TEST_LOW_PRICE)
                .prevClose(TEST_PREV_CLOSE)
                .volume(TEST_VOLUME)
                .question("这只股票怎么样？")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析完成")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析完成"))
                .thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response).isNotNull();
    }

    // ==================== streamChat Tests ====================

    @Test
    @DisplayName("shouldReturnSseEmitterWhenStreamChatCalled")
    void shouldReturnSseEmitterWhenStreamChatCalled() {
        // Given
        Long userId = TEST_USER_ID;
        ChatMessageRequest message = ChatMessageRequest.builder()
                .role("user")
                .content("你好")
                .build();
        ChatStreamRequest request = ChatStreamRequest.builder()
                .provider(DEFAULT_PROVIDER)
                .messages(List.of(message))
                .disableToolCalls(false)
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn(TEST_SESSION_ID);
        when(aiConversationSupport.enrichWithMemoryContext(eq(userId), any())).thenReturn(request);
        when(aiConversationSupport.enrichWithQuantSignalIfNeeded(any(), any())).thenReturn(request);

        // When
        SseEmitter emitter = aiAnalysisService.streamChat(userId, request);

        // Then
        assertThat(emitter).isNotNull();
    }

    @Test
    @DisplayName("shouldAppendNoToolGuardWhenDisableToolCallsIsTrue")
    void shouldAppendNoToolGuardWhenDisableToolCallsIsTrue() {
        // Given
        Long userId = TEST_USER_ID;
        ChatMessageRequest message = ChatMessageRequest.builder()
                .role("user")
                .content("你好")
                .build();
        ChatStreamRequest request = ChatStreamRequest.builder()
                .provider(DEFAULT_PROVIDER)
                .messages(List.of(message))
                .disableToolCalls(true)
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn(TEST_SESSION_ID);
        when(aiConversationSupport.enrichWithMemoryContext(eq(userId), any())).thenReturn(request);
        when(aiConversationSupport.appendInstructionToSystem(any(), anyString())).thenReturn(request);
        when(aiConversationSupport.enrichWithQuantSignalIfNeeded(any(), any())).thenReturn(request);

        // When
        SseEmitter emitter = aiAnalysisService.streamChat(userId, request);

        // Then
        assertThat(emitter).isNotNull();
        verify(aiConversationSupport).appendInstructionToSystem(any(), anyString());
    }

    @Test
    @DisplayName("shouldHandleNullLlmConfigWhenStreaming")
    void shouldHandleNullLlmConfigWhenStreaming() {
        // Given
        Long userId = TEST_USER_ID;
        ChatMessageRequest message = ChatMessageRequest.builder()
                .role("user")
                .content("你好")
                .build();
        ChatStreamRequest request = ChatStreamRequest.builder()
                .provider(DEFAULT_PROVIDER)
                .messages(List.of(message))
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(null);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn(TEST_SESSION_ID);
        when(aiConversationSupport.enrichWithMemoryContext(eq(userId), any())).thenReturn(request);
        when(aiConversationSupport.enrichWithQuantSignalIfNeeded(any(), any())).thenReturn(request);

        // When
        SseEmitter emitter = aiAnalysisService.streamChat(userId, request);

        // Then
        assertThat(emitter).isNotNull();
    }

    // ==================== recommendStrategies Tests ====================

    @Test
    @DisplayName("shouldReturnRecommendationsWhenUserHasStrategies")
    void shouldReturnRecommendationsWhenUserHasStrategies() {
        // Given
        Long userId = TEST_USER_ID;
        StrategyRecommendRequest request = StrategyRecommendRequest.builder()
                .riskPreference("conservative")
                .investmentHorizon("medium")
                .build();

        List<Strategy> userStrategies = List.of(
                Strategy.builder().id(TEST_STRATEGY_ID_1).name("MA Cross").build(),
                Strategy.builder().id(TEST_STRATEGY_ID_2).name("RSI Strategy").build()
        );

        StrategyRecommendResponse expectedResponse = StrategyRecommendResponse.builder()
                .riskProfile("conservative")
                .build();

        when(strategyRepository.findByUserId(userId)).thenReturn(userStrategies);
        when(aiRecommendationSupport.buildStrategyRecommendations(userStrategies, request))
                .thenReturn(expectedResponse);

        // When
        StrategyRecommendResponse response = aiAnalysisService.recommendStrategies(userId, request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getRiskProfile()).isEqualTo("conservative");
    }

    @Test
    @DisplayName("shouldReturnEmptyRecommendationsWhenUserHasNoStrategies")
    void shouldReturnEmptyRecommendationsWhenUserHasNoStrategies() {
        // Given
        Long userId = TEST_USER_ID;
        StrategyRecommendRequest request = StrategyRecommendRequest.builder()
                .riskPreference("aggressive")
                .build();

        StrategyRecommendResponse expectedResponse = StrategyRecommendResponse.builder()
                .riskProfile("aggressive")
                .recommendations(Collections.emptyList())
                .build();

        when(strategyRepository.findByUserId(userId)).thenReturn(Collections.emptyList());
        when(aiRecommendationSupport.buildStrategyRecommendations(Collections.emptyList(), request))
                .thenReturn(expectedResponse);

        // When
        StrategyRecommendResponse response = aiAnalysisService.recommendStrategies(userId, request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getRecommendations()).isEmpty();
    }

    // ==================== interpretBacktest Tests ====================

    @Test
    @DisplayName("shouldReturnInterpretationWhenBacktestResultExists")
    void shouldReturnInterpretationWhenBacktestResultExists() {
        // Given
        Long userId = TEST_USER_ID;
        Long backtestResultId = TEST_BACKTEST_RESULT_ID;

        BacktestResult result = BacktestResult.builder()
                .id(backtestResultId)
                .userId(userId)
                .strategyId(TEST_STRATEGY_ID_1)
                .totalReturn(new BigDecimal(TEST_TOTAL_RETURN))
                .build();

        BacktestInterpretResponse expectedResponse = BacktestInterpretResponse.builder()
                .backtestResultId(backtestResultId)
                .strategyName("策略 1")
                .build();

        when(backtestResultRepository.findByIdAndUserId(backtestResultId, userId))
                .thenReturn(Optional.of(result));
        when(aiRecommendationSupport.buildBacktestInterpretation(backtestResultId, result))
                .thenReturn(expectedResponse);

        // When
        BacktestInterpretResponse response = aiAnalysisService.interpretBacktest(userId, backtestResultId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getBacktestResultId()).isEqualTo(backtestResultId);
    }

    @Test
    @DisplayName("shouldThrowResourceNotFoundWhenBacktestResultNotExists")
    void shouldThrowResourceNotFoundWhenBacktestResultNotExists() {
        // Given
        Long userId = TEST_USER_ID;
        Long backtestResultId = TEST_BACKTEST_RESULT_ID_NONEXISTENT;

        when(backtestResultRepository.findByIdAndUserId(backtestResultId, userId))
                .thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> aiAnalysisService.interpretBacktest(userId, backtestResultId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Backtest result");
    }

    // ==================== assessRisk Tests ====================

    @Test
    @DisplayName("shouldReturnRiskAssessmentWhenPositionsExist")
    void shouldReturnRiskAssessmentWhenPositionsExist() {
        // Given
        Long userId = TEST_USER_ID;
        Long portfolioId = TEST_PORTFOLIO_ID;

        List<PortfolioPosition> positions = List.of(
                PortfolioPosition.builder()
                        .id(TEST_POSITION_ID_1)
                        .symbol(TEST_SYMBOL_MOUTAI)
                        .quantity(new BigDecimal(TEST_QUANTITY_1))
                        .build(),
                PortfolioPosition.builder()
                        .id(TEST_POSITION_ID_2)
                        .symbol(TEST_SYMBOL_POSITION_2)
                        .quantity(new BigDecimal(TEST_QUANTITY_2))
                        .build()
        );

        RiskAssessmentResponse expectedResponse = RiskAssessmentResponse.builder()
                .portfolioId(portfolioId)
                .overallRiskScore(TEST_RISK_SCORE_HIGH)
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(positions);
        when(aiRecommendationSupport.buildRiskAssessment(portfolioId, positions))
                .thenReturn(expectedResponse);

        // When
        RiskAssessmentResponse response = aiAnalysisService.assessRisk(userId, portfolioId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getPortfolioId()).isEqualTo(portfolioId);
        assertThat(response.getOverallRiskScore()).isEqualTo(TEST_RISK_SCORE_HIGH);
    }

    @Test
    @DisplayName("shouldReturnRiskAssessmentWhenNoPositions")
    void shouldReturnRiskAssessmentWhenNoPositions() {
        // Given
        Long userId = TEST_USER_ID;
        Long portfolioId = TEST_PORTFOLIO_ID;

        RiskAssessmentResponse expectedResponse = RiskAssessmentResponse.builder()
                .portfolioId(portfolioId)
                .overallRiskScore(TEST_RISK_SCORE_MEDIUM)
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(Collections.emptyList());
        when(aiRecommendationSupport.buildRiskAssessment(portfolioId, Collections.emptyList()))
                .thenReturn(expectedResponse);

        // When
        RiskAssessmentResponse response = aiAnalysisService.assessRisk(userId, portfolioId);

        // Then
        assertThat(response).isNotNull();
    }

    // ==================== Provider Resolution Tests ====================

    @Test
    @DisplayName("shouldResolveOpenAiProviderWhenSpecified")
    void shouldResolveOpenAiProviderWhenSpecified() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .provider(PROVIDER_OPENAI)
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "OpenAI分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, PROVIDER_OPENAI)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("OpenAI分析结果"))
                .thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo(PROVIDER_OPENAI);
    }

    @Test
    @DisplayName("shouldNormalizeProviderToLowercase")
    void shouldNormalizeProviderToLowercase() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .provider("DeepSeek")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, PROVIDER_DEEPSEEK)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果"))
                .thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo(PROVIDER_DEEPSEEK);
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenAgentReturnsNullBody")
    void shouldThrowExceptionWhenAgentReturnsNullBody() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(TEST_API_KEY)
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(null));

        // When & Then
        assertThatThrownBy(() -> aiAnalysisService.analyzeStock(userId, request))
                .isInstanceOf(ExternalServiceException.class)
                .hasMessageContaining("Invalid response from agent");
    }

    @Test
    @DisplayName("shouldHandleNullEffectiveConfigApiKey")
    void shouldHandleNullEffectiveConfigApiKey() {
        // Given
        Long userId = TEST_USER_ID;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol(TEST_SYMBOL_MOUTAI)
                .market(TEST_MARKET_ASHARE)
                .question("分析")
                .build();

        LlmConfigDto llmConfig = LlmConfigDto.builder()
                .apiKey(null)
                .apiBase(null)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        given(restTemplate.exchange(
            anyString(),
            any(HttpMethod.class),
            any(HttpEntity.class),
            any(org.springframework.core.ParameterizedTypeReference.class)
        )).willReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果"))
                .thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response).isNotNull();
    }
}
