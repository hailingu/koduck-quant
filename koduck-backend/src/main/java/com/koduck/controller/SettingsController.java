package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.settings.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.UserSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * REST API controller for system and user settings.
 *
 * @author koduck
 * @date 2026-03-05
 */
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
@Validated
@Tag(name = "Settings", description = "User preferences, theme, notifications, trading preferences, etc.")
@Slf4j
public class SettingsController {

    private final AuthenticatedUserResolver authenticatedUserResolver;
    private final UserSettingsService settingsService;

    /**
     * Retrieve settings for the authenticated user.
     *
     * @param userPrincipal authenticated user principal
     * @return wrapped user settings payload
     */
    @GetMapping
    public ApiResponse<UserSettingsDto> getSettings(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("GET /api/v1/settings: user={}", userId);

        UserSettingsDto settings = settingsService.getSettings(userId);
        return ApiResponse.success(settings);
    }

    /**
     * Update settings for the authenticated user.
     *
     * @param userPrincipal authenticated user principal
     * @param request request payload for updating settings
     * @return wrapped updated settings payload
     */
    @PutMapping
    public ApiResponse<UserSettingsDto> updateSettings(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateSettingsRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("PUT /api/v1/settings: user={}", userId);

        UserSettingsDto settings = settingsService.updateSettings(userId, request);
        return ApiResponse.success(settings);
    }

    /**
     * Update theme preference for the authenticated user.
     *
     * @param userPrincipal authenticated user principal
     * @param request request payload containing target theme
     * @return wrapped updated settings payload
     */
    @PutMapping("/theme")
    public ApiResponse<UserSettingsDto> updateTheme(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateThemeRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("PUT /api/v1/settings/theme: user={}, theme={}", userId, request.getTheme());

        UserSettingsDto settings = settingsService.updateTheme(userId, request.getTheme());
        return ApiResponse.success(settings);
    }

    /**
     * Update notification settings for the authenticated user.
     *
     * @param userPrincipal authenticated user principal
     * @param request request payload containing notification preferences
     * @return wrapped updated settings payload
     */
    @PutMapping("/notification")
    public ApiResponse<UserSettingsDto> updateNotification(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateNotificationRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("PUT /api/v1/settings/notification: user={}", userId);

        UserSettingsDto settings = settingsService.updateNotification(userId, request);
        return ApiResponse.success(settings);
    }
}
