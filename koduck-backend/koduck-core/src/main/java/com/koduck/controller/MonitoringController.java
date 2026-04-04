package com.koduck.controller;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;

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

import com.koduck.common.constants.PaginationConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.monitoring.AlertRuleRequest;
import com.koduck.entity.market.DataSourceStatus;
import com.koduck.entity.market.StockRealtime;
import com.koduck.entity.strategy.AlertHistory;
import com.koduck.entity.strategy.AlertRule;
import com.koduck.service.MonitoringService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 监控告警 API 控制器。
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/monitoring")
@Tag(name = "监控告警", description = "数据新鲜度监控、告警规则、告警历史等监控接口")
@SecurityRequirement(name = "bearerAuth")
@Slf4j
@RequiredArgsConstructor
public class MonitoringController {

    /** 监控操作服务。 */
    private final MonitoringService monitoringService;

    // ==================== Data Freshness ====================

    /**
     * 获取数据新鲜度指标。
     *
     * @return 数据新鲜度信息
     */
    @Operation(
        summary = "获取数据新鲜度",
        description = "获取各数据源的最新数据时间戳和延迟情况"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/freshness")
    public ApiResponse<Map<String, Object>> getDataFreshness() {
        return ApiResponse.success(monitoringService.getDataFreshnessMetrics());
    }

    /**
     * 获取延迟股票。
     *
     * @param thresholdSeconds 延迟阈值（秒）
     * @param limit 返回股票数量上限
     * @return 延迟股票列表
     */
    @Operation(
        summary = "获取延迟股票",
        description = "获取数据延迟超过阈值的股票列表"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = StockRealtime.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
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
     * 检查单只股票延迟。
     *
     * @param symbol 股票代码
     * @param thresholdSeconds 延迟阈值（秒）
     * @return 该股票的延迟信息
     */
    @Operation(
        summary = "检查单只股票延迟",
        description = "检查指定股票的数据延迟情况"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
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
     * 获取所有告警规则。
     *
     * @return 所有告警规则列表
     */
    @Operation(
        summary = "获取告警规则列表",
        description = "获取所有告警规则"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = AlertRule.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/rules")
    public ApiResponse<List<AlertRule>> getAllRules() {
        return ApiResponse.success(monitoringService.getAllRules());
    }

    /**
     * 获取已启用的告警规则。
     *
     * @return 已启用的告警规则列表
     */
    @Operation(
        summary = "获取启用的告警规则",
        description = "获取所有已启用的告警规则"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = AlertRule.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/rules/enabled")
    public ApiResponse<List<AlertRule>> getEnabledRules() {
        return ApiResponse.success(monitoringService.getEnabledRules());
    }

    /**
     * 根据 ID 获取告警规则。
     *
     * @param id 规则 ID
     * @return 告警规则详情
     */
    @Operation(
        summary = "获取告警规则详情",
        description = "获取指定ID的告警规则详情"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = AlertRule.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/rules/{id}")
    public ApiResponse<AlertRule> getRuleById(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id) {
        return ApiResponse.success(monitoringService.getRuleById(id));
    }

    /**
     * 创建新告警规则。
     *
     * @param request 告警规则请求
     * @return 创建的告警规则
     */
    @Operation(
        summary = "创建告警规则",
        description = "创建新的告警规则"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "创建成功",
                content = @Content(schema = @Schema(implementation = AlertRule.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/rules")
    public ApiResponse<AlertRule> createRule(@Valid @RequestBody AlertRuleRequest request) {
        return ApiResponse.success(monitoringService.createRule(toAlertRule(request)));
    }

    /**
     * 更新告警规则。
     *
     * @param id 规则 ID
     * @param request 告警规则请求
     * @return 更新后的告警规则
     */
    @Operation(
        summary = "更新告警规则",
        description = "更新指定ID的告警规则"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "更新成功",
                content = @Content(schema = @Schema(implementation = AlertRule.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/rules/{id}")
    public ApiResponse<AlertRule> updateRule(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id,
            @Valid @RequestBody AlertRuleRequest request) {
        return ApiResponse.success(monitoringService.updateRule(id, toAlertRule(request)));
    }

    /**
     * 删除告警规则。
     *
     * @param id 规则 ID
     * @return 空响应
     */
    @Operation(
        summary = "删除告警规则",
        description = "删除指定ID的告警规则"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(
            @Parameter(description = "规则ID", example = "1")
            @PathVariable Long id) {
        monitoringService.deleteRule(id);
        return ApiResponse.success(null);
    }

    /**
     * 启用或禁用规则。
     *
     * @param id 规则 ID
     * @param enabled 是否启用该规则
     * @return 更新后的告警规则
     */
    @Operation(
        summary = "启用/禁用告警规则",
        description = "启用或禁用指定ID的告警规则"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "操作成功",
                content = @Content(schema = @Schema(implementation = AlertRule.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "告警规则不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
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
     * 获取告警历史。
     *
     * @param page 页码
     * @param size 每页大小
     * @return 告警历史列表
     */
    @Operation(
        summary = "获取告警历史",
        description = "分页获取告警历史记录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = AlertHistory.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
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
     * 获取待处理告警。
     *
     * @return 待处理告警列表
     */
    @Operation(
        summary = "获取待处理告警",
        description = "获取所有待处理的告警"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = AlertHistory.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts/pending")
    public ApiResponse<List<AlertHistory>> getPendingAlerts() {
        return ApiResponse.success(monitoringService.getPendingAlerts());
    }

    /**
     * 按严重级别获取告警。
     *
     * @param severity 告警严重级别
     * @return 指定严重级别的告警列表
     */
    @Operation(
        summary = "按严重级别获取告警",
        description = "获取指定严重级别的告警"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = AlertHistory.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts/severity/{severity}")
    public ApiResponse<List<AlertHistory>> getAlertsBySeverity(
            @Parameter(description = "严重级别", example = "HIGH",
                schema = @Schema(allowableValues = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}))
            @PathVariable String severity) {
        return ApiResponse.success(monitoringService.getAlertsBySeverity(severity));
    }

    /**
     * 解决告警。
     *
     * @param id 告警 ID
     * @return 已解决的告警
     */
    @Operation(
        summary = "解决告警",
        description = "将指定告警标记为已解决"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "操作成功",
                content = @Content(schema = @Schema(implementation = AlertHistory.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "告警不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/alerts/{id}/resolve")
    public ApiResponse<AlertHistory> resolveAlert(
            @Parameter(description = "告警ID", example = "1")
            @PathVariable Long id) {
        return ApiResponse.success(monitoringService.resolveAlert(id));
    }

    /**
     * 获取告警统计。
     *
     * @return 告警统计数据
     */
    @Operation(
        summary = "获取告警统计",
        description = "获取告警统计数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/alerts/statistics")
    public ApiResponse<Map<String, Long>> getAlertStatistics() {
        return ApiResponse.success(monitoringService.getAlertStatistics());
    }

    // ==================== Data Sources ====================

    /**
     * 获取所有数据源状态。
     *
     * @return 数据源状态列表
     */
    @Operation(
        summary = "获取数据源状态",
        description = "获取所有数据源的状态信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = DataSourceStatus.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/datasources")
    public ApiResponse<List<DataSourceStatus>> getAllDataSources() {
        return ApiResponse.success(monitoringService.getAllDataSources());
    }

    /**
     * 根据名称获取数据源。
     *
     * @param sourceName 数据源名称
     * @return 数据源状态
     */
    @Operation(
        summary = "获取指定数据源",
        description = "获取指定名称的数据源状态"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = DataSourceStatus.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "数据源不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/datasources/{sourceName}")
    public ApiResponse<DataSourceStatus> getDataSourceByName(
            @Parameter(description = "数据源名称", example = "tushare")
            @PathVariable String sourceName) {
        return ApiResponse.success(monitoringService.getDataSourceByName(sourceName));
    }

    /**
     * 获取异常数据源。
     *
     * @return 异常数据源列表
     */
    @Operation(
        summary = "获取异常数据源",
        description = "获取所有状态异常的数据源"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "获取成功",
                content = @Content(schema = @Schema(implementation = DataSourceStatus.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/datasources/unhealthy")
    public ApiResponse<List<DataSourceStatus>> getUnhealthyDataSources() {
        return ApiResponse.success(monitoringService.getUnhealthyDataSources());
    }

    // ==================== Dashboard ====================

    /**
     * 获取监控仪表盘汇总。
     *
     * @return 仪表盘汇总数据
     */
    @Operation(
        summary = "获取监控仪表盘",
        description = "获取监控仪表盘汇总数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> getDashboard() {
        return ApiResponse.success(monitoringService.getDashboardSummary());
    }

    /**
     * 手动执行监控检查。
     *
     * @return 空响应
     */
    @Operation(
        summary = "手动执行监控检查",
        description = "手动触发一次监控检查"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "检查完成"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
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
