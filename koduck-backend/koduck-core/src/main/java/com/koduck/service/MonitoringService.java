package com.koduck.service;

import java.util.List;
import java.util.Map;

import com.koduck.market.entity.DataSourceStatus;
import com.koduck.market.entity.StockRealtime;
import com.koduck.entity.strategy.AlertHistory;
import com.koduck.entity.strategy.AlertRule;

/**
 * 监控和告警服务接口。
 *
 * @author Koduck Team
 */
public interface MonitoringService {

    // ==================== Data Freshness Monitoring ====================

    /**
     * 获取数据新鲜度指标。
     *
     * @return 股票数据延迟指标
     */
    Map<String, Object> getDataFreshnessMetrics();

    /**
     * 获取延迟股票。
     *
     * @param thresholdSeconds 延迟阈值（秒）
     * @param limit 限制数量
     * @return 延迟股票列表
     */
    List<StockRealtime> getDelayedStocks(int thresholdSeconds, int limit);

    /**
     * 检查单只股票延迟。
     *
     * @param symbol 股票代码
     * @param thresholdSeconds 延迟阈值（秒）
     * @return 延迟信息
     */
    Map<String, Object> checkSingleStockDelay(String symbol, int thresholdSeconds);

    // ==================== Alert Rule Management ====================

    /**
     * 获取所有告警规则。
     *
     * @return 告警规则列表
     */
    List<AlertRule> getAllRules();

    /**
     * 获取启用的告警规则。
     *
     * @return 启用的告警规则列表
     */
    List<AlertRule> getEnabledRules();

    /**
     * 根据ID获取告警规则。
     *
     * @param id 规则ID
     * @return 告警规则
     */
    AlertRule getRuleById(Long id);

    /**
     * 创建新告警规则。
     *
     * @param rule 告警规则
     * @return 创建的规则
     */
    AlertRule createRule(AlertRule rule);

    /**
     * 更新告警规则。
     *
     * @param id 规则ID
     * @param rule 告警规则
     * @return 更新后的规则
     */
    AlertRule updateRule(Long id, AlertRule rule);

    /**
     * 删除告警规则。
     *
     * @param id 规则ID
     */
    void deleteRule(Long id);

    /**
     * 启用或禁用规则。
     *
     * @param id 规则ID
     * @param enabled 是否启用
     * @return 更新后的规则
     */
    AlertRule setRuleEnabled(Long id, boolean enabled);

    // ==================== Alert History ====================

    /**
     * 分页获取告警历史。
     *
     * @param page 页码
     * @param size 每页大小
     * @return 告警历史列表
     */
    List<AlertHistory> getAlertHistory(int page, int size);

    /**
     * 获取待处理告警。
     *
     * @return 待处理告警列表
     */
    List<AlertHistory> getPendingAlerts();

    /**
     * 按严重程度获取告警。
     *
     * @param severity 严重程度
     * @return 告警列表
     */
    List<AlertHistory> getAlertsBySeverity(String severity);

    /**
     * 解决告警。
     *
     * @param alertId 告警ID
     * @return 更新后的告警
     */
    AlertHistory resolveAlert(Long alertId);

    /**
     * 获取告警统计。
     *
     * @return 告警统计
     */
    Map<String, Long> getAlertStatistics();

    // ==================== Data Source Status ====================

    /**
     * 获取所有数据源状态。
     *
     * @return 数据源状态列表
     */
    List<DataSourceStatus> getAllDataSources();

    /**
     * 按名称获取数据源。
     *
     * @param sourceName 数据源名称
     * @return 数据源状态
     */
    DataSourceStatus getDataSourceByName(String sourceName);

    /**
     * 更新数据源状态。
     *
     * @param sourceName 数据源名称
     * @param sourceType 数据源类型
     * @param success 是否成功
     * @param responseTimeMs 响应时间（毫秒）
     * @return 更新后的数据源状态
     */
    DataSourceStatus updateDataSourceStatus(String sourceName, String sourceType,
        boolean success, Integer responseTimeMs);

    /**
     * 获取不健康的数据源。
     *
     * @return 不健康数据源列表
     */
    List<DataSourceStatus> getUnhealthyDataSources();

    // ==================== Monitoring Check ====================

    /**
     * 运行所有监控检查。
     */
    void runMonitoringCheck();

    /**
     * 获取监控仪表板摘要。
     *
     * @return 仪表板摘要
     */
    Map<String, Object> getDashboardSummary();
}
