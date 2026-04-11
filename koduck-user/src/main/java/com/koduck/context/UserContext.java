package com.koduck.context;

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

/**
 * 从 APISIX 网关透传的请求头中提取用户上下文信息。
 *
 * <p>APISIX 在 JWT 验签后，将用户身份注入以下 Header：</p>
 * <ul>
 *   <li>{@code X-User-Id} - 用户ID</li>
 *   <li>{@code X-Username} - 用户名</li>
 *   <li>{@code X-Roles} - 角色列表（逗号分隔）</li>
 *   <li>{@code X-Tenant-Id} - 租户ID</li>
 * </ul>
 */
public final class UserContext {

    private static final String DEFAULT_TENANT_ID = "default";
    private static final String HEADER_USER_ID = "X-User-Id";
    private static final String HEADER_USERNAME = "X-Username";
    private static final String HEADER_ROLES = "X-Roles";
    private static final String HEADER_TENANT_ID = "X-Tenant-Id";

    private UserContext() {
    }

    public static Long getUserId(HttpServletRequest request) {
        String userId = request.getHeader(HEADER_USER_ID);
        if (userId == null || userId.isBlank()) {
            throw new IllegalStateException("缺少用户身份信息: " + HEADER_USER_ID);
        }
        try {
            return Long.parseLong(userId);
        } catch (NumberFormatException e) {
            throw new IllegalStateException("无效的用户ID格式: " + userId);
        }
    }

    public static String getUsername(HttpServletRequest request) {
        return request.getHeader(HEADER_USERNAME);
    }

    public static String getTenantId(HttpServletRequest request) {
        String tenantId = request.getHeader(HEADER_TENANT_ID);
        if (tenantId == null || tenantId.isBlank()) {
            return DEFAULT_TENANT_ID;
        }
        return tenantId;
    }

    public static List<String> getRoles(HttpServletRequest request) {
        String roles = request.getHeader(HEADER_ROLES);
        if (roles == null || roles.isBlank()) {
            return List.of();
        }
        return List.of(roles.split(","));
    }

    public static boolean hasRole(HttpServletRequest request, String role) {
        return getRoles(request).stream()
                .anyMatch(r -> r.equalsIgnoreCase(role));
    }

    public static boolean hasAnyRole(HttpServletRequest request, String... roles) {
        List<String> userRoles = getRoles(request);
        for (String role : roles) {
            if (userRoles.stream().anyMatch(r -> r.equalsIgnoreCase(role))) {
                return true;
            }
        }
        return false;
    }
}
