package com.koduck.service;

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
import com.koduck.dto.settings.UserSettingsDto;
import com.koduck.entity.BacktestResult;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Strategy;
import com.koduck.exception.ExternalServiceException;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.BacktestResultRepository;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.service.impl.AiAnalysisServiceImpl;
import com.koduck.service.support.AiConversationSupport;
import com.koduck.service.support.AiRecommendationSupport;
import com.koduck.service.support.AiStreamRelaySupport;
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

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AiAnalysisServiceImpl}.
 *
 * @author GitHub Copilot
 * @date 2026-04-01
 */
@ExtendWith(MockitoExtension.class)
class AiAnalysisServiceImplTest {

    @Mock
    private PortfolioPositionRepository positionRepository;

    @Mock
    private StrategyRepository strategyRepository;

    @Mock
    private BacktestResultRepository backtestResultRepository;

    @Mock
    private UserSettingsService userSettingsService;

    @Mock
    private AgentConfig agentConfig;

    @Mock
    private RestTemplateBuilder restTemplateBuilder;

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private AiConversationSupport aiConversationSupport;

    @Mock
    private AiStreamRelaySupport aiStreamRelaySupport;

    @Mock
    private AiRecommendationSupport aiRecommendationSupport;

    private ObjectMapper objectMapper;
    private AiAnalysisServiceImpl aiAnalysisService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        lenient().when(restTemplateBuilder.connectTimeout(any(Duration.class))).thenReturn(restTemplateBuilder);
        lenient().when(restTemplateBuilder.readTimeout(any(Duration.class))).thenReturn(restTemplateBuilder);
        lenient().when(restTemplateBuilder.build()).thenReturn(restTemplate);
        lenient().when(agentConfig.getUrl()).thenReturn("http://agent:8000");

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
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .name("贵州茅台")
                .price(1500.0)
                .analysisType("comprehensive")
                .question("分析这只股票")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .apiBase("http://test-api.com")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "这是一个买入信号")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("这是一个买入信号")).thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getAnalysis()).isEqualTo("这是一个买入信号");
        assertThat(response.getSymbol()).isEqualTo("600519");
        assertThat(response.getRecommendation()).isEqualTo("建议买入");
        assertThat(response.getProvider()).isEqualTo("minimax");
    }

    @Test
    @DisplayName("shouldUseDefaultProviderWhenProviderIsNull")
    void shouldUseDefaultProviderWhenProviderIsNull() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .provider(null)
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果")).thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo("minimax");
    }

    @Test
    @DisplayName("shouldUseDeepseekProviderWhenSpecified")
    void shouldUseDeepseekProviderWhenSpecified() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .provider("deepseek")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "Deepseek分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "deepseek")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("Deepseek分析结果")).thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo("deepseek");
    }

    @Test
    @DisplayName("shouldFallbackToMinimaxWhenUnsupportedProviderSpecified")
    void shouldFallbackToMinimaxWhenUnsupportedProviderSpecified() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .provider("unsupported")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果")).thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo("minimax");
    }

    @Test
    @DisplayName("shouldThrowExternalServiceExceptionWhenAgentCallFails")
    void shouldThrowExternalServiceExceptionWhenAgentCallFails() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenThrow(new RuntimeException("Connection refused"));

        // When & Then
        assertThatThrownBy(() -> aiAnalysisService.analyzeStock(userId, request))
                .isInstanceOf(ExternalServiceException.class)
                .hasMessageContaining("AI 分析服务调用失败");
    }

    @Test
    @DisplayName("shouldThrowExternalServiceExceptionWhenAgentReturnsEmptyChoices")
    void shouldThrowExternalServiceExceptionWhenAgentReturnsEmptyChoices() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of("choices", Collections.emptyList());

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));

        // When & Then
        assertThatThrownBy(() -> aiAnalysisService.analyzeStock(userId, request))
                .isInstanceOf(ExternalServiceException.class)
                .hasMessageContaining("Invalid response from agent");
    }

    @Test
    @DisplayName("shouldBuildPromptWithAllFieldsWhenRequestHasAllData")
    void shouldBuildPromptWithAllFieldsWhenRequestHasAllData() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .name("贵州茅台")
                .price(1500.0)
                .changePercent(2.5)
                .openPrice(1480.0)
                .high(1520.0)
                .low(1470.0)
                .prevClose(1460.0)
                .volume(10000L)
                .question("这只股票怎么样？")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析完成")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析完成")).thenReturn("建议买入");

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
        Long userId = 1L;
        ChatMessageRequest message = ChatMessageRequest.builder()
                .role("user")
                .content("你好")
                .build();
        ChatStreamRequest request = ChatStreamRequest.builder()
                .provider("minimax")
                .messages(List.of(message))
                .disableToolCalls(false)
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn("session-123");
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
        Long userId = 1L;
        ChatMessageRequest message = ChatMessageRequest.builder()
                .role("user")
                .content("你好")
                .build();
        ChatStreamRequest request = ChatStreamRequest.builder()
                .provider("minimax")
                .messages(List.of(message))
                .disableToolCalls(true)
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn("session-123");
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
        Long userId = 1L;
        ChatMessageRequest message = ChatMessageRequest.builder()
                .role("user")
                .content("你好")
                .build();
        ChatStreamRequest request = ChatStreamRequest.builder()
                .provider("minimax")
                .messages(List.of(message))
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(null);
        when(aiConversationSupport.resolveSessionId(any())).thenReturn("session-123");
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
        Long userId = 1L;
        StrategyRecommendRequest request = StrategyRecommendRequest.builder()
                .riskPreference("conservative")
                .investmentHorizon("medium")
                .build();

        List<Strategy> userStrategies = List.of(
                Strategy.builder().id(1L).name("MA Cross").build(),
                Strategy.builder().id(2L).name("RSI Strategy").build()
        );

        StrategyRecommendResponse expectedResponse = StrategyRecommendResponse.builder()
                .riskProfile("conservative")
                .build();

        when(strategyRepository.findByUserId(userId)).thenReturn(userStrategies);
        when(aiRecommendationSupport.buildStrategyRecommendations(userStrategies, request)).thenReturn(expectedResponse);

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
        Long userId = 1L;
        StrategyRecommendRequest request = StrategyRecommendRequest.builder()
                .riskPreference("aggressive")
                .build();

        StrategyRecommendResponse expectedResponse = StrategyRecommendResponse.builder()
                .riskProfile("aggressive")
                .recommendations(Collections.emptyList())
                .build();

        when(strategyRepository.findByUserId(userId)).thenReturn(Collections.emptyList());
        when(aiRecommendationSupport.buildStrategyRecommendations(Collections.emptyList(), request)).thenReturn(expectedResponse);

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
        Long userId = 1L;
        Long backtestResultId = 100L;

        BacktestResult result = BacktestResult.builder()
                .id(backtestResultId)
                .userId(userId)
                .strategyId(1L)
                .totalReturn(new BigDecimal("0.15"))
                .build();

        BacktestInterpretResponse expectedResponse = BacktestInterpretResponse.builder()
                .backtestResultId(backtestResultId)
                .strategyName("策略 1")
                .build();

        when(backtestResultRepository.findByIdAndUserId(backtestResultId, userId)).thenReturn(Optional.of(result));
        when(aiRecommendationSupport.buildBacktestInterpretation(backtestResultId, result)).thenReturn(expectedResponse);

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
        Long userId = 1L;
        Long backtestResultId = 999L;

        when(backtestResultRepository.findByIdAndUserId(backtestResultId, userId)).thenReturn(Optional.empty());

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
        Long userId = 1L;
        Long portfolioId = 10L;

        List<PortfolioPosition> positions = List.of(
                PortfolioPosition.builder().id(1L).symbol("600519").quantity(new BigDecimal("100")).build(),
                PortfolioPosition.builder().id(2L).symbol("000001").quantity(new BigDecimal("500")).build()
        );

        RiskAssessmentResponse expectedResponse = RiskAssessmentResponse.builder()
                .portfolioId(portfolioId)
                .overallRiskScore(65)
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(positions);
        when(aiRecommendationSupport.buildRiskAssessment(portfolioId, positions)).thenReturn(expectedResponse);

        // When
        RiskAssessmentResponse response = aiAnalysisService.assessRisk(userId, portfolioId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getPortfolioId()).isEqualTo(portfolioId);
        assertThat(response.getOverallRiskScore()).isEqualTo(65);
    }

    @Test
    @DisplayName("shouldReturnRiskAssessmentWhenNoPositions")
    void shouldReturnRiskAssessmentWhenNoPositions() {
        // Given
        Long userId = 1L;
        Long portfolioId = 10L;

        RiskAssessmentResponse expectedResponse = RiskAssessmentResponse.builder()
                .portfolioId(portfolioId)
                .overallRiskScore(50)
                .build();

        when(positionRepository.findByUserId(userId)).thenReturn(Collections.emptyList());
        when(aiRecommendationSupport.buildRiskAssessment(portfolioId, Collections.emptyList())).thenReturn(expectedResponse);

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
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .provider("openai")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "OpenAI分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "openai")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("OpenAI分析结果")).thenReturn("建议买入");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo("openai");
    }

    @Test
    @DisplayName("shouldNormalizeProviderToLowercase")
    void shouldNormalizeProviderToLowercase() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .provider("DeepSeek")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "deepseek")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果")).thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response.getProvider()).isEqualTo("deepseek");
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenAgentReturnsNullBody")
    void shouldThrowExceptionWhenAgentReturnsNullBody() {
        // Given
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey("test-api-key")
                .build();

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
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
        Long userId = 1L;
        StockAnalysisRequest request = StockAnalysisRequest.builder()
                .symbol("600519")
                .market("AShare")
                .question("分析")
                .build();

        UserSettingsDto.LlmConfigDto llmConfig = UserSettingsDto.LlmConfigDto.builder()
                .apiKey(null)
                .apiBase(null)
                .build();

        Map<String, Object> agentResponse = Map.of(
                "choices", List.of(Map.of(
                        "message", Map.of("content", "分析结果")
                ))
        );

        when(userSettingsService.getEffectiveLlmConfig(userId, "minimax")).thenReturn(llmConfig);
        when(restTemplate.exchange(
                anyString(), any(HttpMethod.class), any(HttpEntity.class), any(org.springframework.core.ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(agentResponse));
        when(aiRecommendationSupport.generateRecommendationFromResponse("分析结果")).thenReturn("建议观望");

        // When
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(userId, request);

        // Then
        assertThat(response).isNotNull();
    }
}
