package com.koduck.service.support;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 检查{@code user_roles}关联表是否存在并缓存结果。
 *
 * @author GitHub Copilot
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserRolesTableChecker {

    /**
     * 用于检查user_roles关联表是否存在的查询语句。
     */
    private static final String HAS_USER_ROLES_SQL =
            "SELECT COUNT(*) FROM information_schema.tables "
                    + "WHERE table_schema = 'public' AND table_name = 'user_roles'";

    /**
     * 用于元数据查找的JDBC客户端。
     */
    private final JdbcTemplate jdbcTemplate;

    /**
     * 关联表存在性的缓存标志。
     */
    private volatile Boolean userRolesTablePresent;

    /**
     * 返回user_roles关联表是否存在。
     *
     * @return 表存在时返回true
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
