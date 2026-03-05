package com.koduck.service.impl;

import com.koduck.entity.AlertHistory;
import com.koduck.entity.AlertRule;
import com.koduck.entity.DataSourceStatus;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.*;
import com.koduck.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of MonitoringService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringServiceImpl implements MonitoringService {
    
    private final StockRealtimeRepository stockRealtimeRepository;
    private final AlertRuleRepository alertRuleRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final DataSourceStatusRepository dataSourceStatusRepository;
    
    // ==================== Data Freshness Monitoring ====================
    
    @Override
    public Map<String, Object> getDataFreshnessMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        try {
            long totalStocks = stockRealtimeRepository.countAll();
            metrics.put("totalStocks", totalStocks);
            
            // Get delayed stocks (more than 30 seconds)
            long delayedCount = stockRealtimeRepository.countDelayedStocks(30);
            long delayedPercentage = totalStocks > 0 
                ? (delayedCount * 100) / totalStocks 
                : 0;
            
            metrics.put("delayedStocks", delayedCount);
            metrics.put("delayedPercentage", delayedPercentage);
            metrics.put("thresholdSeconds", 30);
            
            // Get recent delay data
            List<StockRealtime> delayedStocks = stockRealtimeRepository.findDelayedStocks(30);
            if (!delayedStocks.isEmpty()) {
                LocalDateTime oldestUpdate = delayedStocks.stream()
                    .map(StockRealtime::getUpdatedAt)
                    .min(LocalDateTime::compareTo)
                    .orElse(null);
                
                if (oldestUpdate != null) {
                    long maxDelaySeconds = Duration.between(oldestUpdate, LocalDateTime.now()).getSeconds();
                    metrics.put("maxDelaySeconds", maxDelaySeconds);
                }
            }
            
            metrics.put("status", "OK");
        } catch (Exception e) {
            log.error("Error getting data freshness metrics", e);
            metrics.put("status", "ERROR");
            metrics.put("error", e.getMessage());
        }
        
        return metrics;
    }
    
    @Override
    public List<StockRealtime> getDelayedStocks(int thresholdSeconds, int limit) {
        return stockRealtimeRepository.findDelayedStocks(thresholdSeconds)
                .stream()
                .limit(limit)
                .collect(Collectors.toList());
    }
    
    @Override
    public Map<String, Object> checkSingleStockDelay(String symbol, int thresholdSeconds) {
        Map<String, Object> result = new HashMap<>();
        
        Optional<StockRealtime> stockOpt = stockRealtimeRepository.findBySymbol(symbol);
        if (stockOpt.isEmpty()) {
            result.put("exists", false);
            result.put("message", "Stock not found: " + symbol);
            return result;
        }
        
        StockRealtime stock = stockOpt.get();
        result.put("exists", true);
        result.put("symbol", symbol);
        result.put("name", stock.getName());
        result.put("updatedAt", stock.getUpdatedAt());
        
        if (stock.getUpdatedAt() != null) {
            long delaySeconds = Duration.between(stock.getUpdatedAt(), LocalDateTime.now()).getSeconds();
            result.put("delaySeconds", delaySeconds);
            result.put("isDelayed", delaySeconds > thresholdSeconds);
            result.put("thresholdSeconds", thresholdSeconds);
        } else {
            result.put("delaySeconds", null);
            result.put("isDelayed", true);
            result.put("message", "No update timestamp available");
        }
        
        return result;
    }
    
    // ==================== Alert Rule Management ====================
    
    @Override
    public List<AlertRule> getAllRules() {
        return alertRuleRepository.findAll();
    }
    
    @Override
    public List<AlertRule> getEnabledRules() {
        return alertRuleRepository.findByEnabledTrue();
    }
    
    @Override
    public AlertRule getRuleById(Long id) {
        return alertRuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rule not found: " + id));
    }
    
    @Override
    @Transactional
    public AlertRule createRule(AlertRule rule) {
        if (rule.getEnabled() == null) {
            rule.setEnabled(true);
        }
        if (rule.getCooldownMinutes() == null) {
            rule.setCooldownMinutes(5);
        }
        return alertRuleRepository.save(rule);
    }
    
    @Override
    @Transactional
    public AlertRule updateRule(Long id, AlertRule rule) {
        AlertRule existing = getRuleById(id);
        
        if (rule.getRuleName() != null) {
            existing.setRuleName(rule.getRuleName());
        }
        if (rule.getRuleType() != null) {
            existing.setRuleType(rule.getRuleType());
        }
        if (rule.getMetricName() != null) {
            existing.setMetricName(rule.getMetricName());
        }
        if (rule.getThreshold() != null) {
            existing.setThreshold(rule.getThreshold());
        }
        if (rule.getOperator() != null) {
            existing.setOperator(rule.getOperator());
        }
        if (rule.getSeverity() != null) {
            existing.setSeverity(rule.getSeverity());
        }
        if (rule.getEnabled() != null) {
            existing.setEnabled(rule.getEnabled());
        }
        if (rule.getCooldownMinutes() != null) {
            existing.setCooldownMinutes(rule.getCooldownMinutes());
        }
        if (rule.getDescription() != null) {
            existing.setDescription(rule.getDescription());
        }
        
        return alertRuleRepository.save(existing);
    }
    
    @Override
    @Transactional
    public void deleteRule(Long id) {
        alertRuleRepository.deleteById(id);
    }
    
    @Override
    @Transactional
    public AlertRule setRuleEnabled(Long id, boolean enabled) {
        AlertRule rule = getRuleById(id);
        rule.setEnabled(enabled);
        return alertRuleRepository.save(rule);
    }
    
    // ==================== Alert History ====================
    
    @Override
    public List<AlertHistory> getAlertHistory(int page, int size) {
        return alertHistoryRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .getContent();
    }
    
    @Override
    public List<AlertHistory> getPendingAlerts() {
        return alertHistoryRepository.findPendingAlerts();
    }
    
    @Override
    public List<AlertHistory> getAlertsBySeverity(String severity) {
        return alertHistoryRepository.findBySeverity(severity);
    }
    
    @Override
    @Transactional
    public AlertHistory resolveAlert(Long alertId) {
        AlertHistory alert = alertHistoryRepository.findById(alertId)
                .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + alertId));
        
        alert.setStatus("RESOLVED");
        alert.setResolvedAt(LocalDateTime.now());
        
        return alertHistoryRepository.save(alert);
    }
    
    @Override
    public Map<String, Long> getAlertStatistics() {
        Map<String, Long> stats = new HashMap<>();
        
        LocalDateTime since = LocalDateTime.now().minusHours(24);
        List<Object[]> counts = alertHistoryRepository.countBySeveritySince(since);
        
        long total = 0;
        long critical = 0;
        long warning = 0;
        
        for (Object[] row : counts) {
            String severity = (String) row[0];
            Long count = (Long) row[1];
            total += count;
            
            if ("CRITICAL".equals(severity)) {
                critical = count;
            } else if ("WARNING".equals(severity)) {
                warning = count;
            }
            
            stats.put(severity.toLowerCase(), count);
        }
        
        stats.put("total", total);
        stats.put("critical", critical);
        stats.put("warning", warning);
        
        return stats;
    }
    
    // ==================== Data Source Status ====================
    
    @Override
    public List<DataSourceStatus> getAllDataSources() {
        return dataSourceStatusRepository.findAll();
    }
    
    @Override
    public DataSourceStatus getDataSourceByName(String sourceName) {
        return dataSourceStatusRepository.findBySourceName(sourceName)
                .orElse(null);
    }
    
    @Override
    @Transactional
    public DataSourceStatus updateDataSourceStatus(String sourceName, String sourceType, 
                                                   boolean success, Integer responseTimeMs) {
        DataSourceStatus status = dataSourceStatusRepository.findBySourceName(sourceName)
                .orElse(DataSourceStatus.builder()
                        .sourceName(sourceName)
                        .sourceType(sourceType)
                        .build());
        
        status.setResponseTimeMs(responseTimeMs);
        
        if (success) {
            status.setStatus("HEALTHY");
            status.setLastSuccessAt(LocalDateTime.now());
            status.setConsecutiveFailures(0);
            status.setFailureCount(status.getFailureCount() != null ? status.getFailureCount() + 1 : 1);
        } else {
            status.setStatus("UNHEALTHY");
            status.setLastFailureAt(LocalDateTime.now());
            status.setConsecutiveFailures(
                status.getConsecutiveFailures() != null ? status.getConsecutiveFailures() + 1 : 1
            );
            status.setFailureCount(status.getFailureCount() != null ? status.getFailureCount() + 1 : 1);
        }
        
        return dataSourceStatusRepository.save(status);
    }
    
    @Override
    public List<DataSourceStatus> getUnhealthyDataSources() {
        return dataSourceStatusRepository.findUnhealthySources();
    }
    
    // ==================== Monitoring Check ====================
    
    @Override
    @Transactional
    public void runMonitoringCheck() {
        log.info("Running monitoring check...");
        
        List<AlertRule> enabledRules = getEnabledRules();
        
        for (AlertRule rule : enabledRules) {
            try {
                checkRule(rule);
            } catch (Exception e) {
                log.error("Error checking rule: {}", rule.getRuleName(), e);
            }
        }
        
        log.info("Monitoring check completed");
    }
    
    private void checkRule(AlertRule rule) {
        String metricName = rule.getMetricName();
        BigDecimal threshold = rule.getThreshold();
        String operator = rule.getOperator();
        
        // Check cooldown - don't fire alert if one was fired recently
        List<AlertHistory> pendingAlerts = alertHistoryRepository.findPendingByRuleId(rule.getId());
        if (!pendingAlerts.isEmpty()) {
            LocalDateTime latestAlertTime = pendingAlerts.stream()
                .map(AlertHistory::getCreatedAt)
                .max(LocalDateTime::compareTo)
                .orElse(null);
            
            if (latestAlertTime != null) {
                long minutesSinceLastAlert = Duration.between(latestAlertTime, LocalDateTime.now()).toMinutes();
                if (minutesSinceLastAlert < rule.getCooldownMinutes()) {
                    log.debug("Rule {} is in cooldown period", rule.getRuleName());
                    return;
                }
            }
        }
        
        // Evaluate rule based on metric type
        boolean triggered = false;
        BigDecimal currentValue = null;
        String message = "";
        
        switch (metricName) {
            case "stock_delay_seconds":
                triggered = checkSingleStockDelayRule(rule, threshold, operator);
                currentValue = getMaxStockDelay();
                message = String.format("单只股票数据延迟: %d秒 (阈值: %d秒)", 
                    currentValue != null ? currentValue.longValue() : 0, threshold.longValue());
                break;
                
            case "stock_delay_percentage":
                triggered = checkMultipleStockDelayRule(rule, threshold, operator);
                currentValue = getStockDelayPercentage();
                message = String.format("%.1f%% 的股票数据延迟超过阈值 (阈值: %.1f%%)", 
                    currentValue != null ? currentValue.doubleValue() : 0, threshold.doubleValue());
                break;
                
            case "consecutive_failures":
                triggered = checkDataSourceFailureRule(rule, threshold, operator);
                currentValue = getMaxConsecutiveFailures();
                message = String.format("数据源最大连续失败次数: %d (阈值: %d)", 
                    currentValue != null ? currentValue.longValue() : 0, threshold.longValue());
                break;
                
            case "cache_hit_rate":
                triggered = checkCacheHitRateRule(rule, threshold, operator);
                currentValue = getCacheHitRate();
                message = String.format("缓存命中率: %.1f%% (阈值: %.1f%%)", 
                    currentValue != null ? currentValue.doubleValue() : 0, threshold.doubleValue());
                break;
                
            default:
                log.warn("Unknown metric: {}", metricName);
        }
        
        if (triggered) {
            createAlert(rule, currentValue, threshold, message);
        }
    }
    
    private boolean checkSingleStockDelayRule(AlertRule rule, BigDecimal threshold, String operator) {
        long maxDelay = getMaxStockDelay() != null ? getMaxStockDelay().longValue() : 0;
        return evaluateCondition(maxDelay, threshold.doubleValue(), operator);
    }
    
    private boolean checkMultipleStockDelayRule(AlertRule rule, BigDecimal threshold, String operator) {
        double percentage = getStockDelayPercentage() != null ? getStockDelayPercentage().doubleValue() : 0;
        return evaluateCondition(percentage, threshold.doubleValue(), operator);
    }
    
    private boolean checkDataSourceFailureRule(AlertRule rule, BigDecimal threshold, String operator) {
        long maxFailures = getMaxConsecutiveFailures() != null ? getMaxConsecutiveFailures().longValue() : 0;
        return evaluateCondition(maxFailures, threshold.doubleValue(), operator);
    }
    
    private boolean checkCacheHitRateRule(AlertRule rule, BigDecimal threshold, String operator) {
        double hitRate = getCacheHitRate() != null ? getCacheHitRate().doubleValue() : 100.0;
        return evaluateCondition(hitRate, threshold.doubleValue(), operator);
    }
    
    private boolean evaluateCondition(double currentValue, double threshold, String operator) {
        return switch (operator) {
            case ">" -> currentValue > threshold;
            case ">=" -> currentValue >= threshold;
            case "<" -> currentValue < threshold;
            case "<=" -> currentValue <= threshold;
            case "=" -> currentValue == threshold;
            case "!=" -> currentValue != threshold;
            default -> false;
        };
    }
    
    private BigDecimal getMaxStockDelay() {
        List<StockRealtime> delayed = stockRealtimeRepository.findDelayedStocks(1);
        if (delayed.isEmpty()) {
            return BigDecimal.ZERO;
        }
        
        LocalDateTime oldestUpdate = delayed.stream()
            .map(StockRealtime::getUpdatedAt)
            .min(LocalDateTime::compareTo)
            .orElse(null);
        
        if (oldestUpdate == null) {
            return BigDecimal.ZERO;
        }
        
        long seconds = Duration.between(oldestUpdate, LocalDateTime.now()).getSeconds();
        return BigDecimal.valueOf(seconds);
    }
    
    private BigDecimal getStockDelayPercentage() {
        long total = stockRealtimeRepository.countAll();
        if (total == 0) {
            return BigDecimal.ZERO;
        }
        
        long delayed = stockRealtimeRepository.countDelayedStocks(30);
        return BigDecimal.valueOf(delayed * 100.0 / total).setScale(2, RoundingMode.HALF_UP);
    }
    
    private BigDecimal getMaxConsecutiveFailures() {
        List<DataSourceStatus> sources = dataSourceStatusRepository.findAll();
        return sources.stream()
            .map(ds -> ds.getConsecutiveFailures() != null ? BigDecimal.valueOf(ds.getConsecutiveFailures()) : BigDecimal.ZERO)
            .max(BigDecimal::compareTo)
            .orElse(BigDecimal.ZERO);
    }
    
    private BigDecimal getCacheHitRate() {
        // TODO: Implement actual cache hit rate calculation from Redis
        // For now, return a default value
        return BigDecimal.valueOf(85.0);
    }
    
    @Transactional
    private void createAlert(AlertRule rule, BigDecimal metricValue, BigDecimal threshold, String message) {
        AlertHistory alert = AlertHistory.builder()
                .alertRuleId(rule.getId())
                .ruleName(rule.getRuleName())
                .severity(rule.getSeverity())
                .metricName(rule.getMetricName())
                .metricValue(metricValue)
                .threshold(threshold)
                .message(message)
                .status("PENDING")
                .notified(false)
                .build();
        
        alertHistoryRepository.save(alert);
        log.info("Alert created: {} - {}", rule.getSeverity(), message);
    }
    
    // ==================== Dashboard ====================
    
    @Override
    public Map<String, Object> getDashboardSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        // Data freshness
        summary.put("dataFreshness", getDataFreshnessMetrics());
        
        // Alert statistics
        summary.put("alerts", getAlertStatistics());
        
        // Data sources
        List<DataSourceStatus> dataSources = dataSourceStatusRepository.findAll();
        summary.put("dataSources", dataSources.size());
        summary.put("healthySources", dataSources.stream()
                .filter(ds -> "HEALTHY".equals(ds.getStatus()))
                .count());
        
        // Recent alerts
        List<AlertHistory> recentAlerts = alertHistoryRepository
                .findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10))
                .getContent();
        summary.put("recentAlerts", recentAlerts);
        
        return summary;
    }
}
