package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.settings.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.UserSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 系统设置 REST API controller.
 */
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
@Tag(name = "系统设置", description = "用户个性化设置、主题、通知、交易偏好等设置接口")
@Slf4j
public class SettingsController {

    private final UserSettingsService settingsService;

    /**
     * 获取用户设置
     */
    @GetMapping
    public ApiResponse<UserSettingsDto> getSettings(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("GET /api/v1/settings: user={}", userId);
        
        UserSettingsDto settings = settingsService.getSettings(userId);
        return ApiResponse.success(settings);
    }

    /**
     * 更新用户设置
     */
    @PutMapping
    public ApiResponse<UserSettingsDto> updateSettings(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateSettingsRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("PUT /api/v1/settings: user={}", userId);
        
        UserSettingsDto settings = settingsService.updateSettings(userId, request);
        return ApiResponse.success(settings);
    }

    /**
     * 更新主题
     */
    @PutMapping("/theme")
    public ApiResponse<UserSettingsDto> updateTheme(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateThemeRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("PUT /api/v1/settings/theme: user={}, theme={}", userId, request.getTheme());
        
        UserSettingsDto settings = settingsService.updateTheme(userId, request.getTheme());
        return ApiResponse.success(settings);
    }

    /**
     * 更新通知设置
     */
    @PutMapping("/notification")
    public ApiResponse<UserSettingsDto> updateNotification(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateNotificationRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("PUT /api/v1/settings/notification: user={}", userId);
        
        UserSettingsDto settings = settingsService.updateNotification(userId, request);
        return ApiResponse.success(settings);
    }
}
