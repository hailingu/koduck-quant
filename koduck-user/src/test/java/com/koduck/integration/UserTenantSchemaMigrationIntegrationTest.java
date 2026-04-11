package com.koduck.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class UserTenantSchemaMigrationIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("koduck_user_tenant_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.enabled", () -> true);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void shouldApplyTenantSchemaMigration() {
        assertEquals(1, countColumn("tenants", "id"));
        assertEquals(1, countColumn("users", "tenant_id"));
        assertEquals(1, countColumn("roles", "tenant_id"));
        assertEquals(1, countColumn("user_roles", "tenant_id"));
        assertEquals(1, countColumn("role_permissions", "tenant_id"));
        assertEquals(1, countColumn("user_credentials", "tenant_id"));

        Integer tenantCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tenants WHERE id = 'default'",
                Integer.class);
        assertEquals(1, tenantCount);

        assertEquals(1, countConstraint("users", "uk_users_tenant_username"));
        assertEquals(1, countConstraint("users", "uk_users_tenant_email"));
        assertEquals(1, countConstraint("roles", "uk_roles_tenant_name"));
        assertEquals(0, countConstraint("users", "uk_users_username"));
        assertEquals(0, countConstraint("users", "uk_users_email"));
        assertEquals(0, countConstraint("roles", "uk_roles_name"));
    }

    @Test
    void shouldUseTenantScopedUniqueness() {
        jdbcTemplate.update(
                "INSERT INTO tenants (id, name, status) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
                "tenant-b",
                "Tenant B",
                "ACTIVE");

        jdbcTemplate.update(
                """
                INSERT INTO users (tenant_id, username, email, password_hash, status)
                VALUES (?, ?, ?, ?, ?)
                """,
                "default",
                "shared-user",
                "shared@example.com",
                "hash-1",
                1);

        jdbcTemplate.update(
                """
                INSERT INTO users (tenant_id, username, email, password_hash, status)
                VALUES (?, ?, ?, ?, ?)
                """,
                "tenant-b",
                "shared-user",
                "shared@example.com",
                "hash-2",
                1);

        assertThrows(
                DuplicateKeyException.class,
                () -> jdbcTemplate.update(
                        """
                        INSERT INTO users (tenant_id, username, email, password_hash, status)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        "default",
                        "shared-user",
                        "other@example.com",
                        "hash-3",
                        1));

        jdbcTemplate.update(
                """
                INSERT INTO roles (tenant_id, name, description)
                VALUES (?, ?, ?)
                """,
                "default",
                "ROLE_AUDITOR",
                "first");

        jdbcTemplate.update(
                """
                INSERT INTO roles (tenant_id, name, description)
                VALUES (?, ?, ?)
                """,
                "tenant-b",
                "ROLE_AUDITOR",
                "second");

        assertThrows(
                DuplicateKeyException.class,
                () -> jdbcTemplate.update(
                        """
                        INSERT INTO roles (tenant_id, name, description)
                        VALUES (?, ?, ?)
                        """,
                        "tenant-b",
                        "ROLE_AUDITOR",
                        "duplicate"));
    }

    private int countColumn(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND column_name = ?
                """,
                Integer.class,
                tableName,
                columnName);
        return count == null ? 0 : count;
    }

    private int countConstraint(String tableName, String constraintName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND constraint_name = ?
                """,
                Integer.class,
                tableName,
                constraintName);
        return count == null ? 0 : count;
    }
}
