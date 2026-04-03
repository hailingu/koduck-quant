package com.koduck.service.support;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Checks whether {@code user_roles} join table exists and caches the result.
 *
 * @author GitHub Copilot
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserRolesTableChecker {

    /**
     * Query used to check the presence of the user_roles join table.
     */
    private static final String HAS_USER_ROLES_SQL =
            "SELECT COUNT(*) FROM information_schema.tables "
                    + "WHERE table_schema = 'public' AND table_name = 'user_roles'";

    /**
     * JDBC client used for metadata lookup.
     */
    private final JdbcTemplate jdbcTemplate;

    /**
     * Cached existence flag for the join table.
     */
    private volatile Boolean userRolesTablePresent;

    /**
     * Returns whether the user_roles join table exists.
     *
     * @return true when the table exists
     */
    public boolean hasUserRolesTable() {
        final Boolean cached = userRolesTablePresent;
        boolean exists;
        if (cached != null) {
            exists = cached;
        }
        else {
            try {
                final Integer count = jdbcTemplate.queryForObject(HAS_USER_ROLES_SQL, Integer.class);
                exists = count != null && count > 0;
            }
            catch (DataAccessException ex) {
                if (log.isWarnEnabled()) {
                    log.warn("Failed to check user_roles table existence, assume missing: {}", ex.getMessage());
                }
                exists = false;
            }
            userRolesTablePresent = exists;
        }
        return exists;
    }
}
