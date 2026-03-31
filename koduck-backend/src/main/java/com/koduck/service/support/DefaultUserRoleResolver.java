package com.koduck.service.support;

import com.koduck.common.constants.RoleConstants;
import com.koduck.entity.Role;
import com.koduck.repository.RoleRepository;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Resolves default USER role ID from database and caches the value.
 */
@Component
@RequiredArgsConstructor
public class DefaultUserRoleResolver {

    private final RoleRepository roleRepository;

    private volatile Integer defaultUserRoleId;

    public int resolveRoleId() {
        Integer cached = defaultUserRoleId;
        if (cached != null) {
            return cached;
        }

        Role role = roleRepository.findByName(RoleConstants.DEFAULT_USER_ROLE_NAME)
                .orElseThrow(() -> new IllegalStateException(
                        "Default role not found in database: " + RoleConstants.DEFAULT_USER_ROLE_NAME));
        Integer roleId = Objects.requireNonNull(role.getId(), "Default user role id must not be null");
        defaultUserRoleId = roleId;
        return roleId;
    }
}
