package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.profile.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profile management controller.
 * <p>Provides endpoints for user profile operations including avatar upload and preferences.</p>
 *
 * @author Koduck Team
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/profile")
@Tag(name = "用户资料", description = "用户资料管理、头像上传、偏好设置接口")
@SecurityRequirement(name = "bearerAuth")
public class ProfileController {

    /**
     * Get current user profile.
     *
     * @return user profile information
     */
    @Operation(
        summary = "获取用户资料",
        description = "获取当前登录用户的详细资料"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = ProfileResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<ProfileResponse> getProfile() {
        return ApiResponse.success(ProfileResponse.builder().build());
    }

    /**
     * Update user profile.
     *
     * @param request profile update request
     * @return updated profile information
     */
    @Operation(
        summary = "更新用户资料",
        description = "更新当前用户的资料信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = ProfileResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping
    public ApiResponse<ProfileResponse> updateProfile(@RequestBody UpdateProfileRequest request) {
        return ApiResponse.success(ProfileResponse.builder().build());
    }

    /**
     * Upload user avatar.
     *
     * @param file avatar image file
     * @return upload result with avatar URL
     */
    @Operation(
        summary = "上传头像",
        description = "上传用户头像图片\n\n" +
                      "支持格式：JPG, PNG\n" +
                      "最大尺寸：2MB"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "上传成功",
            content = @Content(schema = @Schema(implementation = AvatarResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "文件格式不正确或文件过大"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/avatar")
    public ApiResponse<AvatarResponse> uploadAvatar(
            @Schema(description = "头像图片文件", format = "binary")
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.success(AvatarResponse.builder().build());
    }

    /**
     * Get user preferences.
     *
     * @return user preferences
     */
    @Operation(
        summary = "获取用户偏好",
        description = "获取当前用户的偏好设置"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = PreferencesResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/preferences")
    public ApiResponse<PreferencesResponse> getPreferences() {
        return ApiResponse.success(PreferencesResponse.builder().build());
    }

    /**
     * Update user preferences.
     *
     * @param request preferences update request
     * @return updated preferences
     */
    @Operation(
        summary = "更新用户偏好",
        description = "更新当前用户的偏好设置"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = PreferencesResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/preferences")
    public ApiResponse<PreferencesResponse> updatePreferences(@RequestBody UpdatePreferencesRequest request) {
        return ApiResponse.success(PreferencesResponse.builder().build());
    }
}
