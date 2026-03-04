package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.dashboard.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 仪表盘 REST API controller.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "仪表盘", description = "首页数据汇总、资产概览、快捷入口等仪表盘接口")
@Slf4j
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * 获取资产概览
     */
    @GetMapping("/summary")
    public ApiResponse<DashboardSummaryDto> getSummary(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("GET /api/v1/dashboard/summary: user={}", userId);
        
        DashboardSummaryDto summary = dashboardService.getSummary(userId);
        return ApiResponse.success(summary);
    }

    /**
     * 获取收益趋势
     */
    @GetMapping("/profit-trend")
    public ApiResponse<ProfitTrendDto> getProfitTrend(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "30") Integer days) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("GET /api/v1/dashboard/profit-trend: user={}, days={}", userId, days);
        
        // 限制最大天数
        days = Math.min(days, 365);
        
        ProfitTrendDto trend = dashboardService.getProfitTrend(userId, days);
        return ApiResponse.success(trend);
    }

    /**
     * 获取持仓分布
     */
    @GetMapping("/asset-allocation")
    public ApiResponse<AssetAllocationDto> getAssetAllocation(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("GET /api/v1/dashboard/asset-allocation: user={}", userId);
        
        AssetAllocationDto allocation = dashboardService.getAssetAllocation(userId);
        return ApiResponse.success(allocation);
    }

    /**
     * 获取最近动态
     */
    @GetMapping("/recent-activities")
    public ApiResponse<RecentActivityDto> getRecentActivities(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("GET /api/v1/dashboard/recent-activities: user={}", userId);
        
        RecentActivityDto activities = dashboardService.getRecentActivities(userId);
        return ApiResponse.success(activities);
    }

    /**
     * 获取快捷入口
     */
    @GetMapping("/quick-links")
    public ApiResponse<QuickLinkDto> getQuickLinks(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("GET /api/v1/dashboard/quick-links: user={}", userId);
        
        QuickLinkDto links = dashboardService.getQuickLinks(userId);
        return ApiResponse.success(links);
    }
}
