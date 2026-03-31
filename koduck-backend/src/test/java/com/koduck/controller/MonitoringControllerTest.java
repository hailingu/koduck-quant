package com.koduck.controller;

import com.koduck.security.JwtAuthenticationFilter;
import com.koduck.service.MonitoringService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web layer tests for {@link MonitoringController}.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@WebMvcTest(MonitoringController.class)
@AutoConfigureMockMvc(addFilters = false)
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class MonitoringControllerTest {

    private final MockMvc mockMvc;

    @MockitoBean
    private MonitoringService monitoringService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    MonitoringControllerTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    @DisplayName("数据新鲜度接口应正常返回")
    void freshnessShouldReturnOk() throws Exception {
        when(monitoringService.getDataFreshnessMetrics()).thenReturn(Map.of());
        mockMvc.perform(get("/api/v1/monitoring/freshness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"));
    }

    @Test
    @DisplayName("告警规则列表接口应正常返回")
    void rulesShouldReturnOk() throws Exception {
        when(monitoringService.getAllRules()).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/api/v1/monitoring/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("告警历史接口应正常返回")
    void alertsShouldReturnOk() throws Exception {
        when(monitoringService.getAlertHistory(0, 20)).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/api/v1/monitoring/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("数据源列表接口应正常返回")
    void dataSourcesShouldReturnOk() throws Exception {
        when(monitoringService.getAllDataSources()).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/api/v1/monitoring/datasources"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("仪表盘摘要接口应正常返回")
    void dashboardShouldReturnOk() throws Exception {
        when(monitoringService.getDashboardSummary()).thenReturn(Map.of());
        mockMvc.perform(get("/api/v1/monitoring/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"));
    }

    @Test
    @DisplayName("延迟股票接口应正常返回")
    void delayedStocksShouldReturnOk() throws Exception {
        when(monitoringService.getDelayedStocks(anyInt(), anyInt())).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/api/v1/monitoring/delayed-stocks")
                        .param("thresholdSeconds", "30")
                        .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("告警统计接口应正常返回")
    void alertStatisticsShouldReturnOk() throws Exception {
        when(monitoringService.getAlertStatistics()).thenReturn(Map.of());
        mockMvc.perform(get("/api/v1/monitoring/alerts/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"));
    }

    @Test
    @DisplayName("启用规则接口应正常返回")
    void enabledRulesShouldReturnOk() throws Exception {
        when(monitoringService.getEnabledRules()).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/api/v1/monitoring/rules/enabled"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").isArray());
    }
}
