package com.koduck.service.support;

import java.util.Objects;

import org.springframework.stereotype.Component;

import com.koduck.common.constants.RoleConstants;
import com.koduck.entity.auth.Role;
import com.koduck.repository.auth.RoleRepository;

import lombok.RequiredArgsConstructor;

/**
 * 从数据库解析默认USER角色ID并缓存值。
 *
 * @author GitHub Copilot
 */
@Component
@RequiredArgsConstructor
public class DefaultUserRoleResolver {

    /**
     * 用于加载默认角色定义的仓库。
     */
    private final RoleRepository roleRepository;

    /**
     * 缓存的默认角色ID。
     */
    private volatile Integer defaultUserRoleId;

    /**
     * 解析并缓存默认用户角色ID。
     *
     * @return 默认角色ID
     */
    public int resolveRoleId() {
        final Integer cached = defaultUserRoleId;
        int resolvedRoleId;
        if (cached != null) {
            resolvedRoleId = cached;
        }
        else {
            final Role role = roleRepository.findByName(RoleConstants.DEFAULT_USER_ROLE_NAME)
                    .orElseThrow(() -> new IllegalStateException(
                            "Default role not found in database: " + RoleConstants.DEFAULT_USER_ROLE_NAME));
            final Integer roleId = Objects.requireNonNull(role.getId(), "Default user role id must not be null");
            defaultUserRoleId = roleId;
            resolvedRoleId = roleId;
        }
        return resolvedRoleId;
    }
}
