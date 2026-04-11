package com.koduck.controller.user;

import com.koduck.context.AccessControl;
import com.koduck.context.UserContext;
import com.koduck.dto.user.common.ApiResponse;
import com.koduck.dto.user.permission.PermissionInfo;
import com.koduck.dto.user.role.CreateRoleRequest;
import com.koduck.dto.user.role.RoleDetailResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.role.RoleResponse;
import com.koduck.dto.user.role.SetRolePermissionsRequest;
import com.koduck.dto.user.role.UpdateRoleRequest;
import com.koduck.service.RoleService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 角色管理 Controller，覆盖公开 API 的所有角色相关端点。
 *
 * <p>权限要求：</p>
 * <ul>
 *   <li>读操作需要 {@code role:read} 权限</li>
 *   <li>写操作需要 {@code role:write} 权限</li>
 *   <li>删除操作需要 {@code role:delete} 权限</li>
 * </ul>
 *
 * @see com.koduck.context.AccessControl
 */
@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    public ApiResponse<List<RoleInfo>> listRoles(HttpServletRequest request) {
        AccessControl.requirePermission(request, "role:read");
        return ApiResponse.ok(roleService.listRoles(UserContext.getTenantId(request)));
    }

    @GetMapping("/{roleId}")
    public ApiResponse<RoleDetailResponse> getRoleById(
            HttpServletRequest request,
            @PathVariable Integer roleId) {
        AccessControl.requirePermission(request, "role:read");
        return ApiResponse.ok(roleService.getRoleById(UserContext.getTenantId(request), roleId));
    }

    @PostMapping
    public ApiResponse<RoleResponse> createRole(
            HttpServletRequest request,
            @RequestBody @Valid CreateRoleRequest createRequest) {
        AccessControl.requirePermission(request, "role:write");
        return ApiResponse.ok(roleService.createRole(UserContext.getTenantId(request), createRequest));
    }

    @PutMapping("/{roleId}")
    public ApiResponse<RoleResponse> updateRole(
            HttpServletRequest request,
            @PathVariable Integer roleId,
            @RequestBody @Valid UpdateRoleRequest updateRequest) {
        AccessControl.requirePermission(request, "role:write");
        return ApiResponse.ok(roleService.updateRole(UserContext.getTenantId(request), roleId, updateRequest));
    }

    @DeleteMapping("/{roleId}")
    public ApiResponse<Void> deleteRole(
            HttpServletRequest request,
            @PathVariable Integer roleId) {
        AccessControl.requirePermission(request, "role:delete");
        roleService.deleteRole(UserContext.getTenantId(request), roleId);
        return ApiResponse.ok();
    }

    @GetMapping("/{roleId}/permissions")
    public ApiResponse<List<PermissionInfo>> getRolePermissions(
            HttpServletRequest request,
            @PathVariable Integer roleId) {
        AccessControl.requirePermission(request, "role:read");
        return ApiResponse.ok(roleService.getRolePermissions(UserContext.getTenantId(request), roleId));
    }

    @PutMapping("/{roleId}/permissions")
    public ApiResponse<Void> setRolePermissions(
            HttpServletRequest request,
            @PathVariable Integer roleId,
            @RequestBody @Valid SetRolePermissionsRequest permissionsRequest) {
        AccessControl.requirePermission(request, "role:write");
        roleService.setRolePermissions(UserContext.getTenantId(request), roleId, permissionsRequest);
        return ApiResponse.ok();
    }
}
