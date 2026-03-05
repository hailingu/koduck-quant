package com.koduck.service;

import com.koduck.entity.AlertHistory;
import com.koduck.entity.AlertRule;
import com.koduck.entity.DataSourceStatus;
import com.koduck.entity.StockRealtime;

import java.util.List;
import java.util.Map;

/**
 * Monitoring and alerting service interface.
 */
public interface MonitoringService {
    
    // ==================== Data Freshness Monitoring ====================
    
    /**
     * Get data freshness metrics.
     * Returns metrics about stock data delay.
     */
    Map<String, Object> getDataFreshnessMetrics();
    
    /**
     * Get delayed stocks.
     */
    List<StockRealtime> getDelayedStocks(int thresholdSeconds, int limit);
    
    /**
     * Check single stock delay.
     */
    Map<String, Object> checkSingleStockDelay(String symbol, int thresholdSeconds);
    
    // ==================== Alert Rule Management ====================
    
    /**
     * Get all alert rules.
     */
    List<AlertRule> getAllRules();
    
    /**
     * Get enabled alert rules.
     */
    List<AlertRule> getEnabledRules();
    
    /**
     * Get alert rule by ID.
     */
    AlertRule getRuleById(Long id);
    
    /**
     * Create a new alert rule.
     */
    AlertRule createRule(AlertRule rule);
    
    /**
     * Update an alert rule.
     */
    AlertRule updateRule(Long id, AlertRule rule);
    
    /**
     * Delete an alert rule.
     */
    void deleteRule(Long id);
    
    /**
     * Enable or disable a rule.
     */
    AlertRule setRuleEnabled(Long id, boolean enabled);
    
    // ==================== Alert History ====================
    
    /**
     * Get alert history with pagination.
     */
    List<AlertHistory> getAlertHistory(int page, int size);
    
    /**
     * Get pending alerts.
     */
    List<AlertHistory> getPendingAlerts();
    
    /**
     * Get alerts by severity.
     */
    List<AlertHistory> getAlertsBySeverity(String severity);
    
    /**
     * Resolve an alert.
     */
    AlertHistory resolveAlert(Long alertId);
    
    /**
     * Get alert statistics.
     */
    Map<String, Long> getAlertStatistics();
    
    // ==================== Data Source Status ====================
    
    /**
     * Get all data source status.
     */
    List<DataSourceStatus> getAllDataSources();
    
    /**
     * Get data source by name.
     */
    DataSourceStatus getDataSourceByName(String sourceName);
    
    /**
     * Update data source status (called by data sync jobs).
     */
    DataSourceStatus updateDataSourceStatus(String sourceName, String sourceType, boolean success, Integer responseTimeMs);
    
    /**
     * Get unhealthy data sources.
     */
    List<DataSourceStatus> getUnhealthyDataSources();
    
    // ==================== Monitoring Check ====================
    
    /**
     * Run all monitoring checks.
     * This is typically called by a scheduled job.
     */
    void runMonitoringCheck();
    
    /**
     * Get monitoring dashboard summary.
     */
    Map<String, Object> getDashboardSummary();
}
