package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.entity.AlertHistory;
import com.koduck.entity.AlertRule;
import com.koduck.entity.DataSourceStatus;
import com.koduck.entity.StockRealtime;
import com.koduck.service.MonitoringService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Monitoring and alerting API controller.
 */
@RestController
@RequestMapping("/api/v1/monitoring")
@RequiredArgsConstructor
@Tag(name = "监控告警", description = "数据新鲜度监控、告警规则、告警历史等监控接口")
@Slf4j
public class MonitoringController {
    
    private final MonitoringService monitoringService;
    
    // ==================== Data Freshness ====================
    
    /**
     * Get data freshness metrics.
     */
    @GetMapping("/freshness")
    public ApiResponse<Map<String, Object>> getDataFreshness() {
        return ApiResponse.success(monitoringService.getDataFreshnessMetrics());
    }
    
    /**
     * Get delayed stocks.
     */
    @GetMapping("/delayed-stocks")
    public ApiResponse<List<StockRealtime>> getDelayedStocks(
            @RequestParam(defaultValue = "30") int thresholdSeconds,
            @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.success(monitoringService.getDelayedStocks(thresholdSeconds, limit));
    }
    
    /**
     * Check single stock delay.
     */
    @GetMapping("/stock/{symbol}/delay")
    public ApiResponse<Map<String, Object>> checkStockDelay(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "30") int thresholdSeconds) {
        return ApiResponse.success(monitoringService.checkSingleStockDelay(symbol, thresholdSeconds));
    }
    
    // ==================== Alert Rules ====================
    
    /**
     * Get all alert rules.
     */
    @GetMapping("/rules")
    public ApiResponse<List<AlertRule>> getAllRules() {
        return ApiResponse.success(monitoringService.getAllRules());
    }
    
    /**
     * Get enabled alert rules.
     */
    @GetMapping("/rules/enabled")
    public ApiResponse<List<AlertRule>> getEnabledRules() {
        return ApiResponse.success(monitoringService.getEnabledRules());
    }
    
    /**
     * Get alert rule by ID.
     */
    @GetMapping("/rules/{id}")
    public ApiResponse<AlertRule> getRuleById(@PathVariable Long id) {
        return ApiResponse.success(monitoringService.getRuleById(id));
    }
    
    /**
     * Create a new alert rule.
     */
    @PostMapping("/rules")
    public ApiResponse<AlertRule> createRule(@RequestBody AlertRule rule) {
        return ApiResponse.success(monitoringService.createRule(rule));
    }
    
    /**
     * Update an alert rule.
     */
    @PutMapping("/rules/{id}")
    public ApiResponse<AlertRule> updateRule(@PathVariable Long id, @RequestBody AlertRule rule) {
        return ApiResponse.success(monitoringService.updateRule(id, rule));
    }
    
    /**
     * Delete an alert rule.
     */
    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable Long id) {
        monitoringService.deleteRule(id);
        return ApiResponse.success(null);
    }
    
    /**
     * Enable or disable a rule.
     */
    @PatchMapping("/rules/{id}/enable")
    public ApiResponse<AlertRule> setRuleEnabled(
            @PathVariable Long id,
            @RequestParam boolean enabled) {
        return ApiResponse.success(monitoringService.setRuleEnabled(id, enabled));
    }
    
    // ==================== Alert History ====================
    
    /**
     * Get alert history.
     */
    @GetMapping("/alerts")
    public ApiResponse<List<AlertHistory>> getAlertHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(monitoringService.getAlertHistory(page, size));
    }
    
    /**
     * Get pending alerts.
     */
    @GetMapping("/alerts/pending")
    public ApiResponse<List<AlertHistory>> getPendingAlerts() {
        return ApiResponse.success(monitoringService.getPendingAlerts());
    }
    
    /**
     * Get alerts by severity.
     */
    @GetMapping("/alerts/severity/{severity}")
    public ApiResponse<List<AlertHistory>> getAlertsBySeverity(@PathVariable String severity) {
        return ApiResponse.success(monitoringService.getAlertsBySeverity(severity));
    }
    
    /**
     * Resolve an alert.
     */
    @PostMapping("/alerts/{id}/resolve")
    public ApiResponse<AlertHistory> resolveAlert(@PathVariable Long id) {
        return ApiResponse.success(monitoringService.resolveAlert(id));
    }
    
    /**
     * Get alert statistics.
     */
    @GetMapping("/alerts/statistics")
    public ApiResponse<Map<String, Long>> getAlertStatistics() {
        return ApiResponse.success(monitoringService.getAlertStatistics());
    }
    
    // ==================== Data Sources ====================
    
    /**
     * Get all data source status.
     */
    @GetMapping("/datasources")
    public ApiResponse<List<DataSourceStatus>> getAllDataSources() {
        return ApiResponse.success(monitoringService.getAllDataSources());
    }
    
    /**
     * Get data source by name.
     */
    @GetMapping("/datasources/{sourceName}")
    public ApiResponse<DataSourceStatus> getDataSourceByName(@PathVariable String sourceName) {
        return ApiResponse.success(monitoringService.getDataSourceByName(sourceName));
    }
    
    /**
     * Get unhealthy data sources.
     */
    @GetMapping("/datasources/unhealthy")
    public ApiResponse<List<DataSourceStatus>> getUnhealthyDataSources() {
        return ApiResponse.success(monitoringService.getUnhealthyDataSources());
    }
    
    // ==================== Dashboard ====================
    
    /**
     * Get monitoring dashboard summary.
     */
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> getDashboard() {
        return ApiResponse.success(monitoringService.getDashboardSummary());
    }
    
    /**
     * Run monitoring check manually.
     */
    @PostMapping("/check")
    public ApiResponse<Void> runMonitoringCheck() {
        monitoringService.runMonitoringCheck();
        return ApiResponse.success(null);
    }
}
