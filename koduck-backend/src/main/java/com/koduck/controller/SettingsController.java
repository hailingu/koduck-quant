package com.koduck.controller;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.settings.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.UserSettingsService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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
@Tag(name = "用户设置", description = "用户偏好设置、主题、通知等设置接口")
@SecurityRequirement(name = "bearerAuth")
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
    @Operation(
        summary = "获取用户设置",
        description = "获取当前用户的所有设置信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = UserSettingsDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<UserSettingsDto> getSettings(
            @Parameter(description = "当前用户认证信息", hidden = true)
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
    @Operation(
        summary = "更新用户设置",
        description = "更新当前用户的设置信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = UserSettingsDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping
    public ApiResponse<UserSettingsDto> updateSettings(
            @Parameter(description = "当前用户认证信息", hidden = true)
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
    @Operation(
        summary = "更新主题设置",
        description = "更新用户的界面主题偏好"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = UserSettingsDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "主题值无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/theme")
    public ApiResponse<UserSettingsDto> updateTheme(
            @Parameter(description = "当前用户认证信息", hidden = true)
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
    @Operation(
        summary = "更新通知设置",
        description = "更新用户的通知偏好设置"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = UserSettingsDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/notification")
    public ApiResponse<UserSettingsDto> updateNotification(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateNotificationRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("PUT /api/v1/settings/notification: user={}", userId);
        UserSettingsDto settings = settingsService.updateNotification(userId, request);
        return ApiResponse.success(settings);
    }
}
