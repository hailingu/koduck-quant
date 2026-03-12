package com.koduck.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import com.koduck.service.MonitoringService;
import com.koduck.security.JwtAuthenticationFilter;

import java.util.Collections;
import java.util.HashMap;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * MonitoringController 
 */
@WebMvcTest(MonitoringController.class)
@AutoConfigureMockMvc(addFilters = false)
class MonitoringControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MonitoringService monitoringService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Test
    @DisplayName("数据新鲜度接口应正常返回")
    void freshnessShouldReturnOk() throws Exception {
        when(monitoringService.getDataFreshnessMetrics()).thenReturn(new HashMap<>());
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
        when(monitoringService.getDashboardSummary()).thenReturn(new HashMap<>());
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
        when(monitoringService.getAlertStatistics()).thenReturn(new HashMap<>());
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
