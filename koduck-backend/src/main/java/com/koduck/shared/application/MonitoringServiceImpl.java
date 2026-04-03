package com.koduck.shared.application;
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
/**
 * Implementation of MonitoringService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringServiceImpl implements MonitoringService {
    private static final String RULE_NOT_NULL_MESSAGE = "rule must not be null";

    private final StockRealtimeRepository stockRealtimeRepository;
    private final AlertRuleRepository alertRuleRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final DataSourceStatusRepository dataSourceStatusRepository;
    // ==================== Data Freshness Monitoring ====================
    @Override
    public Map<String, Object> getDataFreshnessMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        try {
            long totalStocks = stockRealtimeRepository.count();
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
                .toList();
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
        Long nonNullId = Objects.requireNonNull(id, "id must not be null");
        return alertRuleRepository.findById(nonNullId)
            .orElseThrow(() -> new IllegalArgumentException("Rule not found: " + nonNullId));
    }
    @Override
    @Transactional
    public AlertRule createRule(AlertRule rule) {
        AlertRule nonNullRule = Objects.requireNonNull(rule, RULE_NOT_NULL_MESSAGE);
        if (nonNullRule.getEnabled() == null) {
            nonNullRule.setEnabled(true);
        }
        if (nonNullRule.getCooldownMinutes() == null) {
            nonNullRule.setCooldownMinutes(5);
        }
        return alertRuleRepository.save(nonNullRule);
    }
    @Override
    @Transactional
    public AlertRule updateRule(Long id, AlertRule rule) {
        Objects.requireNonNull(rule, RULE_NOT_NULL_MESSAGE);
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
        return alertRuleRepository.save(Objects.requireNonNull(existing, "existing must not be null"));
    }
    @Override
    @Transactional
    public void deleteRule(Long id) {
        Long nonNullId = Objects.requireNonNull(id, "id must not be null");
        alertRuleRepository.deleteById(nonNullId);
    }
    @Override
    @Transactional
    public AlertRule setRuleEnabled(Long id, boolean enabled) {
        AlertRule rule = getRuleById(id);
        rule.setEnabled(enabled);
        return alertRuleRepository.save(Objects.requireNonNull(rule, RULE_NOT_NULL_MESSAGE));
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
        Long nonNullAlertId = Objects.requireNonNull(alertId, "alertId must not be null");
        AlertHistory alert = alertHistoryRepository.findById(nonNullAlertId)
            .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + nonNullAlertId));
        alert.setStatus("RESOLVED");
        alert.setResolvedAt(LocalDateTime.now());
        return alertHistoryRepository.save(Objects.requireNonNull(alert, "alert must not be null"));
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
            stats.put(severity.toLowerCase(Locale.ROOT), count);
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
                triggered = checkSingleStockDelayRule(threshold, operator);
                currentValue = getMaxStockDelay();
                message = String.format("单只股票数据延迟: %d秒 (阈值: %d秒)", 
                    currentValue.longValue(), threshold.longValue());
                break;
            case "stock_delay_percentage":
                triggered = checkMultipleStockDelayRule(threshold, operator);
                currentValue = getStockDelayPercentage();
                message = String.format("%.1f%% 的股票数据延迟超过阈值 (阈值: %.1f%%)", 
                    currentValue.doubleValue(), threshold.doubleValue());
                break;
            case "consecutive_failures":
                triggered = checkDataSourceFailureRule(threshold, operator);
                currentValue = getMaxConsecutiveFailures();
                message = String.format("数据源最大连续失败次数: %d (阈值: %d)", 
                    currentValue.longValue(), threshold.longValue());
                break;
            case "cache_hit_rate":
                triggered = checkCacheHitRateRule(threshold, operator);
                currentValue = getCacheHitRate();
                message = String.format("缓存命中率: %.1f%% (阈值: %.1f%%)", 
                    currentValue.doubleValue(), threshold.doubleValue());
                break;
            default:
                log.warn("Unknown metric: {}", metricName);
        }
        if (triggered) {
            createAlert(rule, currentValue, threshold, message);
        }
    }
    private boolean checkSingleStockDelayRule(BigDecimal threshold, String operator) {
        long maxDelay = getMaxStockDelay().longValue();
        return evaluateCondition(maxDelay, threshold.doubleValue(), operator);
    }
    private boolean checkMultipleStockDelayRule(BigDecimal threshold, String operator) {
        double percentage = getStockDelayPercentage().doubleValue();
        return evaluateCondition(percentage, threshold.doubleValue(), operator);
    }
    private boolean checkDataSourceFailureRule(BigDecimal threshold, String operator) {
        long maxFailures = getMaxConsecutiveFailures().longValue();
        return evaluateCondition(maxFailures, threshold.doubleValue(), operator);
    }
    private boolean checkCacheHitRateRule(BigDecimal threshold, String operator) {
        double hitRate = getCacheHitRate().doubleValue();
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
        long total = stockRealtimeRepository.count();
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
        // Temporary fallback value before Redis-based metric aggregation is integrated.
        return BigDecimal.valueOf(85.0);
    }
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
            alertHistoryRepository.save(Objects.requireNonNull(alert, "alert must not be null"));
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
