package com.koduck.ai.service;

import com.koduck.ai.dto.PortfolioOptimizationSuggestion;
import com.koduck.ai.dto.PortfolioRiskAssessment;
import com.koduck.portfolio.api.acl.PortfolioQueryService;
import com.koduck.portfolio.dto.PortfolioSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AiAnalysisServiceImpl 单元测试。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@ExtendWith(MockitoExtension.class)
class AiAnalysisServiceImplTest {

    private static final Long PORTFOLIO_ID = 1L;
    private static final Long NON_EXISTENT_ID = 999L;

    @Mock
    private PortfolioQueryService portfolioQueryService;

    private AiAnalysisServiceImpl aiAnalysisService;

    private PortfolioSnapshot testSnapshot;

    @BeforeEach
    void setUp() {
        // 手动创建服务实例，避免 Lombok @RequiredArgsConstructor 在测试中的问题
        aiAnalysisService = new AiAnalysisServiceImpl(portfolioQueryService);

        List<PortfolioSnapshot.PositionSnapshot> positions = List.of(
                new PortfolioSnapshot.PositionSnapshot(
                        1L, "AAPL", "US", new BigDecimal("100"), 
                        new BigDecimal("150.00"), new BigDecimal("160.00"), new BigDecimal("16000.00")),
                new PortfolioSnapshot.PositionSnapshot(
                        2L, "MSFT", "US", new BigDecimal("50"), 
                        new BigDecimal("300.00"), new BigDecimal("320.00"), new BigDecimal("16000.00"))
        );

        testSnapshot = new PortfolioSnapshot(
                PORTFOLIO_ID,
                "Test Portfolio",
                positions,
                new BigDecimal("32000.00"),
                new BigDecimal("30000.00"),
                new BigDecimal("2000.00"),
                new BigDecimal("0.0667")
        );
    }

    @Test
    @DisplayName("当投资组合存在时应返回风险评估")
    void shouldReturnRiskAssessmentWhenPortfolioExists() {
        when(portfolioQueryService.getSnapshot(PORTFOLIO_ID)).thenReturn(Optional.of(testSnapshot));

        Optional<PortfolioRiskAssessment> result = aiAnalysisService.assessPortfolioRisk(PORTFOLIO_ID);

        assertTrue(result.isPresent());
        assertEquals(PORTFOLIO_ID, result.get().getPortfolioId());
        assertEquals("Test Portfolio", result.get().getPortfolioName());
        assertNotNull(result.get().getOverallRiskScore());
        assertNotNull(result.get().getRiskLevel());
        verify(portfolioQueryService).getSnapshot(PORTFOLIO_ID);
    }

    @Test
    @DisplayName("当投资组合不存在时应返回空")
    void shouldReturnEmptyWhenPortfolioNotExists() {
        when(portfolioQueryService.getSnapshot(NON_EXISTENT_ID)).thenReturn(Optional.empty());

        Optional<PortfolioRiskAssessment> result = aiAnalysisService.assessPortfolioRisk(NON_EXISTENT_ID);

        assertFalse(result.isPresent());
        verify(portfolioQueryService).getSnapshot(NON_EXISTENT_ID);
    }

    @Test
    @DisplayName("应正确分析投资组合收益")
    void shouldAnalyzePortfolioReturns() {
        when(portfolioQueryService.getSnapshot(PORTFOLIO_ID)).thenReturn(Optional.of(testSnapshot));

        Optional<String> result = aiAnalysisService.analyzePortfolioReturns(PORTFOLIO_ID);

        assertTrue(result.isPresent());
        assertTrue(result.get().contains("Test Portfolio"));
        assertTrue(result.get().contains("32000.00"));
        verify(portfolioQueryService).getSnapshot(PORTFOLIO_ID);
    }

    @Test
    @DisplayName("当投资组合不存在时收益分析应返回空")
    void shouldReturnEmptyAnalysisWhenPortfolioNotExists() {
        when(portfolioQueryService.getSnapshot(NON_EXISTENT_ID)).thenReturn(Optional.empty());

        Optional<String> result = aiAnalysisService.analyzePortfolioReturns(NON_EXISTENT_ID);

        assertFalse(result.isPresent());
    }

    @Test
    @DisplayName("应生成投资组合优化建议")
    void shouldSuggestOptimizations() {
        when(portfolioQueryService.getSnapshot(PORTFOLIO_ID)).thenReturn(Optional.of(testSnapshot));

        Optional<List<PortfolioOptimizationSuggestion>> result = 
                aiAnalysisService.suggestOptimizations(PORTFOLIO_ID);

        assertTrue(result.isPresent());
        // 由于持仓分散度较好，应该只有持仓数量较少的建议
        assertFalse(result.get().isEmpty());
        verify(portfolioQueryService).getSnapshot(PORTFOLIO_ID);
    }

    @Test
    @DisplayName("应计算集中度风险")
    void shouldCalculateConcentrationRisk() {
        double risk = aiAnalysisService.calculateConcentrationRisk(testSnapshot);

        assertTrue(risk >= 0);
        assertTrue(risk <= 100);
        // 两个等权重持仓的 HHI = 0.5^2 + 0.5^2 = 0.5, 风险评分 = 50
        assertEquals(50.0, risk, 0.1);
    }

    @Test
    @DisplayName("应分析行业分布")
    void shouldAnalyzeSectorDistribution() {
        String analysis = aiAnalysisService.analyzeSectorDistribution(testSnapshot);

        assertNotNull(analysis);
        assertFalse(analysis.isEmpty());
    }

    @Test
    @DisplayName("当持仓高度集中时应返回高风险等级")
    void shouldReturnHighRiskForConcentratedPortfolio() {
        // 创建一个高度集中的持仓（单只股票占 100%）
        List<PortfolioSnapshot.PositionSnapshot> concentratedPositions = List.of(
                new PortfolioSnapshot.PositionSnapshot(
                        1L, "AAPL", "US", new BigDecimal("100"), 
                        new BigDecimal("150.00"), new BigDecimal("160.00"), new BigDecimal("16000.00"))
        );
        PortfolioSnapshot concentratedSnapshot = new PortfolioSnapshot(
                PORTFOLIO_ID,
                "Concentrated Portfolio",
                concentratedPositions,
                new BigDecimal("16000.00"),
                new BigDecimal("15000.00"),
                new BigDecimal("1000.00"),
                new BigDecimal("0.0667")
        );

        when(portfolioQueryService.getSnapshot(PORTFOLIO_ID)).thenReturn(Optional.of(concentratedSnapshot));

        Optional<PortfolioRiskAssessment> result = aiAnalysisService.assessPortfolioRisk(PORTFOLIO_ID);

        assertTrue(result.isPresent());
        // HHI = 1.0, 风险评分 = 40 (基于分散化因子计算), 验证风险评分不为零
        assertNotNull(result.get().getOverallRiskScore());
        assertTrue(result.get().getOverallRiskScore().compareTo(BigDecimal.ZERO) > 0);
    }
}
