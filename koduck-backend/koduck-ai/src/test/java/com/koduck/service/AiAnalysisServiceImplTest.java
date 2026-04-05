package com.koduck.service;

import java.math.BigDecimal;
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
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.acl.BacktestQueryService;
import com.koduck.acl.PortfolioQueryService;
import com.koduck.acl.StrategyQueryService;
import com.koduck.acl.UserSettingsQueryService;
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
import com.koduck.exception.ExternalServiceException;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.service.impl.ai.AiAnalysisServiceImpl;
import com.koduck.service.support.AiConversationSupport;
import com.koduck.service.support.AiRecommendationSupport;
import com.koduck.service.support.AiStreamRelaySupport;

import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    /** Test trade count for backtest. */
    private static final int TEST_TRADE_COUNT = 10;

    /** Test risk score - medium high. */
    private static final int TEST_RISK_SCORE_HIGH = 65;

    /** Test risk score - medium. */
    private static final int TEST_RISK_SCORE_MEDIUM = 50;

    /** Mock query service for portfolio positions. */
    @Mock
    private PortfolioQueryService portfolioQueryService;

    /** Mock query service for strategies. */
    @Mock
    private StrategyQueryService strategyQueryService;

    /** Mock query service for backtest results. */
    @Mock
    private BacktestQueryService backtestQueryService;

    /** Mock query service for user settings. */
    @Mock
    private UserSettingsQueryService userSettingsQueryService;

    /** Mock configuration for agent. */
    @Mock
    private AgentConfig agentConfig;

    /** Mock builder for WebClient. */
    @Mock
    private WebClient.Builder webClientBuilder;

    /** Mock WebClient. */
    @Mock
    private WebClient webClient;

    /** Mock WebClient request spec (using raw type to avoid generic issues). */
    @Mock
    @SuppressWarnings("rawtypes")
    private WebClient.RequestBodyUriSpec requestBodyUriSpec;

    /** Mock WebClient response spec. */
    @Mock
    private WebClient.ResponseSpec responseSpec;

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
        
        // Setup WebClient builder chain
        lenient().when(webClientBuilder.baseUrl(anyString())).thenReturn(webClientBuilder);
        lenient().when(webClientBuilder.build()).thenReturn(webClient);
        lenient().when(agentConfig.getUrl()).thenReturn(TEST_AGENT_URL);
        
        // Setup WebClient request chain using lenient stubbing with thenAnswer
        // to avoid complex generic type issues with WebClient fluent API
        lenient().when(webClient.post()).thenReturn(requestBodyUriSpec);
        lenient().when(requestBodyUriSpec.uri(anyString())).thenAnswer(inv -> requestBodyUriSpec);
        lenient().when(requestBodyUriSpec.contentType(any())).thenAnswer(inv -> requestBodyUriSpec);
        lenient().when(requestBodyUriSpec.bodyValue(any())).thenAnswer(inv -> requestBodyUriSpec);
        lenient().when(requestBodyUriSpec.retrieve()).thenReturn(responseSpec);

        aiAnalysisService = new AiAnalysisServiceImpl(
                portfolioQueryService,
                strategyQueryService,
                backtestQueryService,
                userSettingsQueryService,
                agentConfig,
                objectMapper,
                webClientBuilder,
                aiConversationSupport,
                aiStreamRelaySupport,
                aiRecommendationSupport
        );
    }

    private void mockWebClientResponse(Map<String, Object> response) {
        if (response == null) {
            when(responseSpec.bodyToMono(any(org.springframework.core.ParameterizedTypeReference.class)))
                .thenReturn(Mono.empty());
        }
        else {
            when(responseSpec.bodyToMono(any(org.springframework.core.ParameterizedTypeReference.class)))
                .thenReturn(Mono.just(response));
        }
    }

    private void mockWebClientError(RuntimeException exception) {
        when(responseSpec.bodyToMono(any(org.springframework.core.ParameterizedTypeReference.class)))
                .thenReturn(Mono.error(exception));
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, PROVIDER_DEEPSEEK)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientError(new RuntimeException("Connection refused"));

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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);

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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn(TEST_SESSION_ID);
        when(aiConversationSupport.enrichWithMemoryContext(any(), any())).thenReturn(request);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn(TEST_SESSION_ID);
        when(aiConversationSupport.enrichWithMemoryContext(any(), any())).thenReturn(request);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(null);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn(TEST_SESSION_ID);
        when(aiConversationSupport.enrichWithMemoryContext(any(), any())).thenReturn(request);
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

        List<StrategyQueryService.StrategySummary> userStrategies = List.of(
                new StrategyQueryService.StrategySummary(
                    TEST_STRATEGY_ID_1, "MA Cross", "trend", "Moving average crossover strategy"),
                new StrategyQueryService.StrategySummary(
                    TEST_STRATEGY_ID_2, "RSI Strategy", "momentum", "RSI based strategy")
        );

        StrategyRecommendResponse expectedResponse = StrategyRecommendResponse.builder()
                .riskProfile("conservative")
                .build();

        when(strategyQueryService.findStrategiesByUserId(userId)).thenReturn(userStrategies);
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

        when(strategyQueryService.findStrategiesByUserId(userId)).thenReturn(Collections.emptyList());
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

        BacktestQueryService.BacktestResultSummary result = new BacktestQueryService.BacktestResultSummary(
                backtestResultId,
                TEST_SYMBOL_MOUTAI,
                "MA Cross",
                new BigDecimal(TEST_TOTAL_RETURN),
                new BigDecimal("0.05"),
                TEST_TRADE_COUNT,
                new BigDecimal("1.2"),
                new BigDecimal("0.6")
        );

        BacktestInterpretResponse expectedResponse = BacktestInterpretResponse.builder()
                .backtestResultId(backtestResultId)
                .strategyName("策略 1")
                .build();

        when(backtestQueryService.findResultById(backtestResultId))
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

        when(backtestQueryService.findResultById(backtestResultId))
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

        List<PortfolioQueryService.PortfolioPositionSummary> positions = List.of(
                new PortfolioQueryService.PortfolioPositionSummary(
                        TEST_POSITION_ID_1,
                        TEST_SYMBOL_MOUTAI,
                        TEST_MARKET_ASHARE,
                        new BigDecimal(TEST_QUANTITY_1),
                        new BigDecimal("1000.0"),
                        new BigDecimal(TEST_PRICE_MOUTAI)
                ),
                new PortfolioQueryService.PortfolioPositionSummary(
                        TEST_POSITION_ID_2,
                        TEST_SYMBOL_POSITION_2,
                        TEST_MARKET_ASHARE,
                        new BigDecimal(TEST_QUANTITY_2),
                        new BigDecimal("10.0"),
                        new BigDecimal("12.0")
                )
        );

        RiskAssessmentResponse expectedResponse = RiskAssessmentResponse.builder()
                .portfolioId(portfolioId)
                .overallRiskScore(TEST_RISK_SCORE_HIGH)
                .build();

        when(portfolioQueryService.findPositionsByUserId(userId)).thenReturn(positions);
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

        when(portfolioQueryService.findPositionsByUserId(userId)).thenReturn(Collections.emptyList());
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, PROVIDER_OPENAI)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, PROVIDER_DEEPSEEK)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(null);

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

        when(userSettingsQueryService.getEffectiveLlmConfig(userId, DEFAULT_PROVIDER)).thenReturn(llmConfig);
        mockWebClientResponse(agentResponse);
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果"))
                .thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response).isNotNull();
    }
}
