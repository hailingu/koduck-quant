package com.koduck.service.support;

import java.util.Objects;

import org.springframework.stereotype.Component;

import com.koduck.common.constants.RoleConstants;
import com.koduck.entity.auth.Role;
import com.koduck.repository.auth.RoleRepository;

import lombok.RequiredArgsConstructor;

/**
 * Resolves default USER role ID from database and caches the value.
 *
 * @author GitHub Copilot
 */
@Component
@RequiredArgsConstructor
public class DefaultUserRoleResolver {

    /**
     * Repository used to load the default role definition.
     */
    private final RoleRepository roleRepository;

    /**
     * Cached default role id.
     */
    private volatile Integer defaultUserRoleId;

    /**
     * Resolves and caches the default user role id.
     *
     * @return default role id
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
