package com.koduck.controller.user;

import com.koduck.context.AccessControl;
import com.koduck.context.UserContext;
import com.koduck.dto.user.common.ApiResponse;
import com.koduck.dto.user.permission.PermissionInfo;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.user.AssignRoleRequest;
import com.koduck.dto.user.user.AvatarUploadResponse;
import com.koduck.dto.user.user.ChangePasswordRequest;
import com.koduck.dto.user.user.UpdateProfileRequest;
import com.koduck.dto.user.user.UpdateUserRequest;
import com.koduck.dto.user.user.UpdateUserStatusRequest;
import com.koduck.dto.user.user.UserProfileResponse;
import com.koduck.dto.user.user.UserSummaryResponse;
import com.koduck.service.PermissionService;
import com.koduck.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户管理 Controller，覆盖公开 API 的所有用户相关端点。
 *
 * <p>用户身份由 APISIX 网关通过以下 Header 透传：</p>
 * <ul>
 *   <li>{@code X-User-Id} - 用户ID</li>
 *   <li>{@code X-Username} - 用户名</li>
 *   <li>{@code X-Roles} - 角色列表</li>
 *   <li>{@code X-Tenant-Id} - 租户ID</li>
 * </ul>
 *
 * @see com.koduck.context.UserContext
 */
@RestController
@RequestMapping("/api/v1")
public class UserController {

    private final UserService userService;
    private final PermissionService permissionService;

    public UserController(UserService userService, PermissionService permissionService) {
        this.userService = userService;
        this.permissionService = permissionService;
    }

    // === 当前用户接口 ===

    @GetMapping("/users/me")
    public ApiResponse<UserProfileResponse> getCurrentUser(HttpServletRequest request) {
        String tenantId = UserContext.getTenantId(request);
        Long userId = UserContext.getUserId(request);
        UserProfileResponse profile = userService.getCurrentUser(tenantId, userId);
        return ApiResponse.ok(profile);
    }

    @PutMapping("/users/me")
    public ApiResponse<UserProfileResponse> updateCurrentUser(
            HttpServletRequest request,
            @RequestBody @Valid UpdateProfileRequest updateRequest) {
        String tenantId = UserContext.getTenantId(request);
        Long userId = UserContext.getUserId(request);
        UserProfileResponse profile = userService.updateProfile(tenantId, userId, updateRequest);
        return ApiResponse.ok(profile);
    }

    @PutMapping("/users/me/password")
    public ApiResponse<Void> changePassword(
            HttpServletRequest request,
            @RequestBody @Valid ChangePasswordRequest passwordRequest) {
        // TODO: 密码修改逻辑（需协调 koduck-auth 的密码策略）
        throw new UnsupportedOperationException("密码修改接口待实现");
    }

    @PutMapping("/users/me/avatar")
    public ApiResponse<AvatarUploadResponse> uploadAvatar(HttpServletRequest request) {
        // TODO: 头像上传逻辑（依赖存储配置 Task 6.1）
        throw new UnsupportedOperationException("头像上传接口待实现");
    }

    @DeleteMapping("/users/me")
    public ApiResponse<Void> deleteCurrentUser(HttpServletRequest request) {
        String tenantId = UserContext.getTenantId(request);
        Long userId = UserContext.getUserId(request);
        userService.deleteUser(tenantId, userId);
        return ApiResponse.ok();
    }

    @GetMapping("/users/me/permissions")
    public ApiResponse<List<PermissionInfo>> getCurrentUserPermissions(HttpServletRequest request) {
        String tenantId = UserContext.getTenantId(request);
        Long userId = UserContext.getUserId(request);
        List<String> userPermissionCodes = userService.getCurrentUserPermissions(tenantId, userId);
        List<PermissionInfo> allPermissions = permissionService.listPermissions();
        List<PermissionInfo> userPermissions = allPermissions.stream()
                .filter(p -> userPermissionCodes.contains(p.getCode()))
                .toList();
        return ApiResponse.ok(userPermissions);
    }

    // === 管理员用户管理接口 ===

    @GetMapping("/users/{userId}")
    public ApiResponse<UserProfileResponse> getUserById(
            HttpServletRequest request,
            @PathVariable Long userId) {
        AccessControl.requirePermission(request, "user:read");
        UserProfileResponse profile = userService.getUserById(UserContext.getTenantId(request), userId);
        return ApiResponse.ok(profile);
    }

    @GetMapping("/users")
    public ApiResponse<com.koduck.dto.user.common.PageResponse<UserSummaryResponse>> listUsers(
            HttpServletRequest request,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        AccessControl.requirePermission(request, "user:read");
        String tenantId = UserContext.getTenantId(request);
        Sort sortObj = parseSort(sort);
        PageRequest pageable = PageRequest.of(page, size, sortObj);
        com.koduck.dto.user.common.PageResponse<UserSummaryResponse> result =
                userService.searchUsers(tenantId, keyword, status, pageable);
        return ApiResponse.ok(result);
    }

    @PutMapping("/users/{userId}")
    public ApiResponse<UserProfileResponse> updateUser(
            HttpServletRequest request,
            @PathVariable Long userId,
            @RequestBody @Valid UpdateUserRequest updateRequest) {
        AccessControl.requirePermission(request, "user:write");
        UserProfileResponse profile = userService.updateUser(UserContext.getTenantId(request), userId, updateRequest);
        return ApiResponse.ok(profile);
    }

    @DeleteMapping("/users/{userId}")
    public ApiResponse<Void> deleteUser(
            HttpServletRequest request,
            @PathVariable Long userId) {
        AccessControl.requirePermission(request, "user:delete");
        userService.deleteUser(UserContext.getTenantId(request), userId);
        return ApiResponse.ok();
    }

    @PutMapping("/users/{userId}/status")
    public ApiResponse<UserProfileResponse> updateUserStatus(
            HttpServletRequest request,
            @PathVariable Long userId,
            @RequestBody @Valid UpdateUserStatusRequest statusRequest) {
        AccessControl.requirePermission(request, "user:write");
        UpdateUserRequest updateRequest = UpdateUserRequest.builder()
                .status(statusRequest.getStatus())
                .build();
        UserProfileResponse profile = userService.updateUser(UserContext.getTenantId(request), userId, updateRequest);
        return ApiResponse.ok(profile);
    }

    // === 用户角色管理 ===

    @GetMapping("/users/{userId}/roles")
    public ApiResponse<List<RoleInfo>> getUserRoles(
            HttpServletRequest request,
            @PathVariable Long userId) {
        AccessControl.requirePermission(request, "role:read");
        List<RoleInfo> roles = userService.getUserRolesInfo(UserContext.getTenantId(request), userId);
        return ApiResponse.ok(roles);
    }

    @PostMapping("/users/{userId}/roles")
    public ApiResponse<Void> assignRole(
            HttpServletRequest request,
            @PathVariable Long userId,
            @RequestBody @Valid AssignRoleRequest assignRequest) {
        AccessControl.requirePermission(request, "role:write");
        userService.assignRole(UserContext.getTenantId(request), userId, assignRequest.getRoleId());
        return ApiResponse.ok();
    }

    @DeleteMapping("/users/{userId}/roles/{roleId}")
    public ApiResponse<Void> removeRole(
            HttpServletRequest request,
            @PathVariable Long userId,
            @PathVariable Integer roleId) {
        AccessControl.requirePermission(request, "role:write");
        userService.removeRole(UserContext.getTenantId(request), userId, roleId);
        return ApiResponse.ok();
    }

    // === 辅助方法 ===

    private Sort parseSort(String sortParam) {
        if (sortParam == null || sortParam.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        String[] parts = sortParam.split(",", 2);
        String property = parts[0];
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1])
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        return Sort.by(direction, property);
    }
}
