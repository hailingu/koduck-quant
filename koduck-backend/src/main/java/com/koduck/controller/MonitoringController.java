package com.koduck.controller;

import com.koduck.common.constants.PaginationConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.monitoring.AlertRuleRequest;
import com.koduck.entity.AlertHistory;
import com.koduck.entity.AlertRule;
import com.koduck.entity.DataSourceStatus;
import com.koduck.entity.StockRealtime;
import com.koduck.service.MonitoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Monitoring and alerting API controller.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/monitoring")
@Tag(name = "监控告警", description = "数据新鲜度监控、告警规则、告警历史等监控接口")
@SecurityRequirement(name = "bearerAuth")
@Slf4j
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;

    // ==================== Data Freshness ====================
    /**
     * Get data freshness metrics.
     */
    @Operation(
        summary = "获取数据新鲜度",
        description = "获取各数据源的最新数据时间戳和延迟情况"
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "获取成功"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/freshness")
    public ApiResponse<Map<String, Object>> getDataFreshness() {
        return ApiResponse.success(monitoringService.getDataFreshnessMetrics());
    }

    /**
     * Get delayed stocks.
     */
    @Operation(
        summary = "获取延迟股票",
        description = "获取数据延迟超过阈值的股票列表"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = StockRealtime.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/delayed-stocks")
    public ApiResponse<List<StockRealtime>> getDelayedStocks(
            @Parameter(description = "延迟阈值(秒)", example = "30")
            @RequestParam(defaultValue = "30") int thresholdSeconds,
            @Parameter(description = "返回数量限制", example = "50")
            @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.success(monitoringService.getDelayedStocks(thresholdSeconds, limit));
    }

    /**
     * Check single stock delay.
     */
    @Operation(
        summary = "检查单只股票延迟",
        description = "检查指定股票的数据延迟情况"
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "获取成功"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/stock/{symbol}/delay")
    public ApiResponse<Map<String, Object>> checkStockDelay(
            @Parameter(description = "股票代码", example = "600519")
            @PathVariable String symbol,
            @Parameter(description = "延迟阈值(秒)", example = "30")
            @RequestParam(defaultValue = "30") int thresholdSeconds) {
        return ApiResponse.success(monitoringService.checkSingleStockDelay(symbol, thresholdSeconds));
    }

    // ==================== Alert Rules ====================
    /**
     * Get all alert rules.
     */
    @Operation(
        summary = "获取告警规则列表",
        description = "获取所有告警规则"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = AlertRule.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/rules")
    public ApiResponse<List<AlertRule>> getAllRules() {
        return ApiResponse.success(monitoringService.getAllRules());
    }

    /**
     * Get enabled alert rules.
     */
    @Operation(
        summary = "获取启用的告警规则",
        description = "获取所有已启用的告警规则"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = AlertRule.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/rules/enabled")
    public ApiResponse<List<AlertRule>> getEnabledRules() {
        return ApiResponse.success(monitoringService.getEnabledRules());
    }

    /**
     * Get alert rule by ID.
     */
    @Operation(
        summary = "获取告警规则详情",
        description = "获取指定ID的告警规则详情"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = AlertRule.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/rules/{id}")
    public ApiResponse<AlertRule> getRuleById(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id) {
        return ApiResponse.success(monitoringService.getRuleById(id));
    }

    /**
     * Create a new alert rule.
     */
    @Operation(
        summary = "创建告警规则",
        description = "创建新的告警规则"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "创建成功",
            content = @Content(schema = @Schema(implementation = AlertRule.class))
        ),
        @ApiResponse(responseCode = "400", description = "请求参数错误"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/rules")
    public ApiResponse<AlertRule> createRule(@Valid @RequestBody AlertRuleRequest request) {
        return ApiResponse.success(monitoringService.createRule(toAlertRule(request)));
    }

    /**
     * Update an alert rule.
     */
    @Operation(
        summary = "更新告警规则",
        description = "更新指定ID的告警规则"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = AlertRule.class))
        ),
        @ApiResponse(responseCode = "400", description = "请求参数错误"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/rules/{id}")
    public ApiResponse<AlertRule> updateRule(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id,
            @Valid @RequestBody AlertRuleRequest request) {
        return ApiResponse.success(monitoringService.updateRule(id, toAlertRule(request)));
    }

    /**
     * Delete an alert rule.
     */
    @Operation(
        summary = "删除告警规则",
        description = "删除指定ID的告警规则"
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "删除成功"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id) {
        monitoringService.deleteRule(id);
        return ApiResponse.success(null);
    }

    /**
     * Enable or disable a rule.
     */
    @Operation(
        summary = "启用/禁用告警规则",
        description = "启用或禁用指定ID的告警规则"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "操作成功",
            content = @Content(schema = @Schema(implementation = AlertRule.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PatchMapping("/rules/{id}/enable")
    public ApiResponse<AlertRule> setRuleEnabled(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id,
            @Parameter(description = "是否启用", example = "true")
            @RequestParam boolean enabled) {
        return ApiResponse.success(monitoringService.setRuleEnabled(id, enabled));
    }

    // ==================== Alert History ====================
    /**
     * Get alert history.
     */
    @Operation(
        summary = "获取告警历史",
        description = "分页获取告警历史记录"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = AlertHistory.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts")
    public ApiResponse<List<AlertHistory>> getAlertHistory(
            @Parameter(description = "页码，从0开始", example = "0")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ZERO_STR) int page,
            @Parameter(description = "每页数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR) int size) {
        return ApiResponse.success(monitoringService.getAlertHistory(page, size));
    }

    /**
     * Get pending alerts.
     */
    @Operation(
        summary = "获取待处理告警",
        description = "获取所有待处理的告警"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = AlertHistory.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts/pending")
    public ApiResponse<List<AlertHistory>> getPendingAlerts() {
        return ApiResponse.success(monitoringService.getPendingAlerts());
    }

    /**
     * Get alerts by severity.
     */
    @Operation(
        summary = "按严重级别获取告警",
        description = "获取指定严重级别的告警"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = AlertHistory.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts/severity/{severity}")
    public ApiResponse<List<AlertHistory>> getAlertsBySeverity(
            @Parameter(description = "严重级别", example = "HIGH", allowableValues = {"LOW", "MEDIUM", "HIGH", "CRITICAL"})
            @PathVariable String severity) {
        return ApiResponse.success(monitoringService.getAlertsBySeverity(severity));
    }

    /**
     * Resolve an alert.
     */
    @Operation(
        summary = "解决告警",
        description = "将指定告警标记为已解决"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "操作成功",
            content = @Content(schema = @Schema(implementation = AlertHistory.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "404", description = "告警不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/alerts/{id}/resolve")
    public ApiResponse<AlertHistory> resolveAlert(
            @Parameter(description = "告警ID", example = "1")
            @PathVariable Long id) {
        return ApiResponse.success(monitoringService.resolveAlert(id));
    }

    /**
     * Get alert statistics.
     */
    @Operation(
        summary = "获取告警统计",
        description = "获取告警统计数据"
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "获取成功"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts/statistics")
    public ApiResponse<Map<String, Long>> getAlertStatistics() {
        return ApiResponse.success(monitoringService.getAlertStatistics());
    }

    // ==================== Data Sources ====================
    /**
     * Get all data source status.
     */
    @Operation(
        summary = "获取数据源状态",
        description = "获取所有数据源的状态信息"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = DataSourceStatus.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/datasources")
    public ApiResponse<List<DataSourceStatus>> getAllDataSources() {
        return ApiResponse.success(monitoringService.getAllDataSources());
    }

    /**
     * Get data source by name.
     */
    @Operation(
        summary = "获取指定数据源",
        description = "获取指定名称的数据源状态"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = DataSourceStatus.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "404", description = "数据源不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/datasources/{sourceName}")
    public ApiResponse<DataSourceStatus> getDataSourceByName(
            @Parameter(description = "数据源名称", example = "tushare")
            @PathVariable String sourceName) {
        return ApiResponse.success(monitoringService.getDataSourceByName(sourceName));
    }

    /**
     * Get unhealthy data sources.
     */
    @Operation(
        summary = "获取异常数据源",
        description = "获取所有状态异常的数据源"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = DataSourceStatus.class))
        ),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/datasources/unhealthy")
    public ApiResponse<List<DataSourceStatus>> getUnhealthyDataSources() {
        return ApiResponse.success(monitoringService.getUnhealthyDataSources());
    }

    // ==================== Dashboard ====================
    /**
     * Get monitoring dashboard summary.
     */
    @Operation(
        summary = "获取监控仪表盘",
        description = "获取监控仪表盘汇总数据"
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "获取成功"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> getDashboard() {
        return ApiResponse.success(monitoringService.getDashboardSummary());
    }

    /**
     * Run monitoring check manually.
     */
    @Operation(
        summary = "手动执行监控检查",
        description = "手动触发一次监控检查"
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "检查完成"),
        @ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/check")
    public ApiResponse<Void> runMonitoringCheck() {
        monitoringService.runMonitoringCheck();
        return ApiResponse.success(null);
    }

    private AlertRule toAlertRule(AlertRuleRequest request) {
        return AlertRule.builder()
                .ruleName(request.ruleName())
                .ruleType(request.ruleType())
                .metricName(request.metricName())
                .threshold(request.threshold())
                .operator(request.operator())
                .severity(request.severity())
                .enabled(request.enabled())
                .cooldownMinutes(request.cooldownMinutes())
                .description(request.description())
                .build();
    }
}
