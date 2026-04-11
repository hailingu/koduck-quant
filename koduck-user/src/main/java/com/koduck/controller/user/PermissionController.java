package com.koduck.controller.user;

import com.koduck.context.UserContext;
import com.koduck.dto.user.common.ApiResponse;
import com.koduck.dto.user.permission.PermissionInfo;
import com.koduck.service.PermissionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 权限管理 Controller，覆盖公开 API 的权限查询端点。
 *
 * <p>所有端点仅需已认证用户即可访问（由 APISIX JWT 认证保障）。</p>
 *
 * @see com.koduck.context.UserContext
 */
@RestController
@RequestMapping("/api/v1")
public class PermissionController {

    private final PermissionService permissionService;

    public PermissionController(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    @GetMapping("/permissions")
    public ApiResponse<List<PermissionInfo>> listPermissions(HttpServletRequest request) {
        UserContext.getUserId(request);
        return ApiResponse.ok(permissionService.listPermissions());
    }

    @GetMapping("/users/{userId}/permissions")
    public ApiResponse<List<String>> getUserPermissions(
            HttpServletRequest request,
            @PathVariable Long userId) {
        UserContext.getUserId(request);
        return ApiResponse.ok(permissionService.getUserPermissions(UserContext.getTenantId(request), userId));
    }
}
