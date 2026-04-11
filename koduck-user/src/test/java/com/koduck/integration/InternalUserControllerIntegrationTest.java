package com.koduck.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.dto.user.user.CreateUserRequest;
import com.koduck.dto.user.user.LastLoginUpdateRequest;
import com.koduck.entity.user.User;
import com.koduck.repository.user.UserRepository;
import com.koduck.repository.user.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class InternalUserControllerIntegrationTest {

    private static final String DEFAULT_TENANT_ID = "default";
    private static final String TENANT_B = "tenant-b";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("koduck_user_test")
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
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private UserRoleRepository userRoleRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM roles WHERE tenant_id <> ?", DEFAULT_TENANT_ID);
        jdbcTemplate.update("DELETE FROM tenants WHERE id <> 'default'");
        jdbcTemplate.update("DELETE FROM user_roles");
        jdbcTemplate.update("DELETE FROM users");
        jdbcTemplate.update(
                "INSERT INTO tenants (id, name, status) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
                TENANT_B,
                "Tenant B",
                "ACTIVE");
        jdbcTemplate.update(
                "INSERT INTO roles (tenant_id, name, description) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                TENANT_B,
                "ROLE_USER",
                "tenant default role");
    }

    @Test
    void shouldCreateAndFindUserViaInternalControllerWithRealDatabase() throws Exception {
        String unique = String.valueOf(System.nanoTime());
        CreateUserRequest request = CreateUserRequest.builder()
                .username("it-user-" + unique)
                .email("it-" + unique + "@koduck.local")
                .passwordHash("hash")
                .nickname("it-user")
                .status("ACTIVE")
                .build();

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(request.getUsername()))
                .andExpect(jsonPath("$.email").value(request.getEmail()));

        User created = userRepository.findByTenantIdAndUsername(TENANT_B, request.getUsername()).orElseThrow();
        assertNotNull(created.getId());
        assertEquals(1, userRoleRepository.findByTenantIdAndUserId(TENANT_B, created.getId()).size(),
                "new user should have default role");

        mockMvc.perform(get("/internal/users/by-username/{username}", request.getUsername())
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.getId()))
                .andExpect(jsonPath("$.username").value(request.getUsername()));
    }

    @Test
    void shouldPersistLastLoginUpdateViaInternalController() throws Exception {
        String unique = String.valueOf(System.nanoTime());
        User user = userRepository.save(User.builder()
                .tenantId(DEFAULT_TENANT_ID)
                .username("login-user-" + unique)
                .email("login-" + unique + "@koduck.local")
                .passwordHash("hash")
                .build());

        LastLoginUpdateRequest request = LastLoginUpdateRequest.builder()
                .loginTime(LocalDateTime.of(2026, 4, 9, 10, 30, 0))
                .ipAddress("10.0.0.1")
                .build();

        mockMvc.perform(put("/internal/users/{userId}/last-login", user.getId())
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", DEFAULT_TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(request.getLoginTime(), reloaded.getLastLoginAt());
        assertEquals(request.getIpAddress(), reloaded.getLastLoginIp());
    }

    @Test
    void shouldFallbackToDefaultTenantWhenTenantHeaderMissing() throws Exception {
        String unique = String.valueOf(System.nanoTime());
        User user = userRepository.save(User.builder()
                .tenantId(DEFAULT_TENANT_ID)
                .username("fallback-user-" + unique)
                .email("fallback-" + unique + "@koduck.local")
                .passwordHash("hash")
                .build());

        mockMvc.perform(get("/internal/users/by-username/{username}", user.getUsername())
                        .header("X-Consumer-Username", "koduck-auth"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId()))
                .andExpect(jsonPath("$.username").value(user.getUsername()));
    }

    @Test
    void shouldKeepUsernameAndEmailLookupTenantScopedAcrossTenants() throws Exception {
        String unique = String.valueOf(System.nanoTime());
        String sharedUsername = "shared-user-" + unique;
        String sharedEmail = "shared-" + unique + "@koduck.local";

        User defaultUser = userRepository.save(User.builder()
                .tenantId(DEFAULT_TENANT_ID)
                .username(sharedUsername)
                .email(sharedEmail)
                .passwordHash("hash")
                .build());
        User tenantBUser = userRepository.save(User.builder()
                .tenantId(TENANT_B)
                .username(sharedUsername)
                .email(sharedEmail)
                .passwordHash("hash")
                .build());

        mockMvc.perform(get("/internal/users/by-username/{username}", sharedUsername)
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", DEFAULT_TENANT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(defaultUser.getId()))
                .andExpect(jsonPath("$.tenantId").value(DEFAULT_TENANT_ID));

        mockMvc.perform(get("/internal/users/by-username/{username}", sharedUsername)
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tenantBUser.getId()))
                .andExpect(jsonPath("$.tenantId").value(TENANT_B));

        mockMvc.perform(get("/internal/users/by-email/{email}", sharedEmail)
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", DEFAULT_TENANT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(defaultUser.getId()))
                .andExpect(jsonPath("$.tenantId").value(DEFAULT_TENANT_ID));

        mockMvc.perform(get("/internal/users/by-email/{email}", sharedEmail)
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tenantBUser.getId()))
                .andExpect(jsonPath("$.tenantId").value(TENANT_B));
    }

    @Test
    void shouldRejectDuplicateUsernameAndEmailWithinSameTenant() throws Exception {
        String unique = String.valueOf(System.nanoTime());
        CreateUserRequest first = CreateUserRequest.builder()
                .username("dup-user-" + unique)
                .email("dup-" + unique + "@koduck.local")
                .passwordHash("hash")
                .nickname("dup")
                .status("ACTIVE")
                .build();

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(first)))
                .andExpect(status().isOk());

        CreateUserRequest duplicateUsername = CreateUserRequest.builder()
                .username(first.getUsername())
                .email("other-" + unique + "@koduck.local")
                .passwordHash("hash")
                .nickname("dup2")
                .status("ACTIVE")
                .build();

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateUsername)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("用户名已存在: " + first.getUsername()));

        CreateUserRequest duplicateEmail = CreateUserRequest.builder()
                .username("other-user-" + unique)
                .email(first.getEmail())
                .passwordHash("hash")
                .nickname("dup3")
                .status("ACTIVE")
                .build();

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_B)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateEmail)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("邮箱已被使用: " + first.getEmail()));
    }
}
