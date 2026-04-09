package com.koduck.context;

import com.koduck.exception.AccessDeniedException;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;
import java.util.Set;

/**
 * 基于角色名称的权限校验工具类。
 *
 * <p>将权限码（如 {@code role:read}）映射到角色名称（如 {@code ROLE_ADMIN}），
 * 通过 {@link UserContext} 从 APISIX 透传的 Header 中获取用户角色进行校验。</p>
 *
 * <p>当前阶段采用静态映射，后续 Task 6.2 可替换为基于数据库的动态权限校验。</p>
 *
 * @see UserContext
 */
public final class AccessControl {

    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    /**
     * 角色到权限码的映射。
     *
     * <p>ROLE_SUPER_ADMIN 不在此映射中，因为它拥有所有权限，在校验逻辑中特殊处理。</p>
     */
    private static final Map<String, Set<String>> ROLE_PERMISSIONS = Map.of(
            ROLE_ADMIN, Set.of(
                    "role:read", "role:write", "role:delete",
                    "user:read", "user:write", "user:delete"
            )
    );

    private AccessControl() {
    }

    /**
     * 校验当前用户是否拥有指定权限，无权限时抛出 {@link AccessDeniedException}。
     *
     * @param request     HTTP 请求（用于读取 X-Roles Header）
     * @param permission  所需权限码（如 {@code role:read}）
     * @throws AccessDeniedException 权限不足时抛出
     */
    public static void requirePermission(HttpServletRequest request, String permission) {
        if (UserContext.hasRole(request, ROLE_SUPER_ADMIN)) {
            return;
        }

        boolean hasPermission = ROLE_PERMISSIONS.entrySet().stream()
                .filter(entry -> UserContext.hasRole(request, entry.getKey()))
                .anyMatch(entry -> entry.getValue().contains(permission));

        if (!hasPermission) {
            throw new AccessDeniedException("权限不足，需要: " + permission);
        }
    }
}
