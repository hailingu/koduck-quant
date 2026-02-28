package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.common.PageResponse;
import com.koduck.dto.user.*;
import com.koduck.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 用户管理控制器
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 获取当前用户信息
     */
    @GetMapping("/me")
    public ApiResponse<UserDetailResponse> getCurrentUser(
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        Long userId = Long.valueOf(principal.getUsername());
        UserDetailResponse response = userService.getCurrentUser(userId);
        return ApiResponse.success(response);
    }

    /**
     * 更新当前用户资料
     */
    @PutMapping("/me")
    public ApiResponse<UserDetailResponse> updateProfile(
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        Long userId = Long.valueOf(principal.getUsername());
        UserDetailResponse response = userService.updateProfile(userId, request);
        return ApiResponse.success(response);
    }

    /**
     * 修改当前用户密码
     */
    @PutMapping("/me/password")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        Long userId = Long.valueOf(principal.getUsername());
        userService.changePassword(userId, request);
        return ApiResponse.success();
    }

    /**
     * 获取用户列表（管理员）
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<UserDetailResponse>> listUsers(
            @Valid UserPageRequest request) {
        PageResponse<UserDetailResponse> response = userService.listUsers(request);
        return ApiResponse.success(response);
    }

    /**
     * 获取用户详情（管理员）
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> getUserById(@PathVariable Long id) {
        UserDetailResponse response = userService.getUserById(id);
        return ApiResponse.success(response);
    }

    /**
     * 创建用户（管理员）
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        UserDetailResponse response = userService.createUser(request);
        return ApiResponse.success(response);
    }

    /**
     * 更新用户（管理员）
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        UserDetailResponse response = userService.updateUser(id, request);
        return ApiResponse.success(response);
    }

    /**
     * 删除用户（管理员）
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteUser(
            @PathVariable Long id,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        Long currentUserId = Long.valueOf(principal.getUsername());
        userService.deleteUser(id, currentUserId);
        return ApiResponse.success();
    }
}
