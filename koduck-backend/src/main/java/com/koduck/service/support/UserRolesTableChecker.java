package com.koduck.service.support;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Checks whether {@code user_roles} join table exists and caches the result.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserRolesTableChecker {

    private static final String USER_ROLES_TABLE_EXISTS_SQL =
            "SELECT COUNT(*) FROM information_schema.tables "
                    + "WHERE table_schema = 'public' AND table_name = 'user_roles'";

    private final JdbcTemplate jdbcTemplate;

    private volatile Boolean userRolesTableExists;

    public boolean hasUserRolesTable() {
        Boolean cached = userRolesTableExists;
        if (cached != null) {
            return cached;
        }

        boolean exists;
        try {
            Integer count = jdbcTemplate.queryForObject(USER_ROLES_TABLE_EXISTS_SQL, Integer.class);
            exists = count != null && count > 0;
        } catch (DataAccessException ex) {
            log.warn("Failed to check user_roles table existence, assume missing: {}", ex.getMessage());
            exists = false;
        }

        userRolesTableExists = exists;
        return exists;
    }
}
