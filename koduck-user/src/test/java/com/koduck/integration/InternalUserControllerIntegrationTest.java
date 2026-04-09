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
        jdbcTemplate.update("DELETE FROM user_roles");
        jdbcTemplate.update("DELETE FROM users");
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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(request.getUsername()))
                .andExpect(jsonPath("$.email").value(request.getEmail()));

        User created = userRepository.findByUsername(request.getUsername()).orElseThrow();
        assertNotNull(created.getId());
        assertEquals(1, userRoleRepository.findByUserId(created.getId()).size(), "new user should have default role");

        mockMvc.perform(get("/internal/users/by-username/{username}", request.getUsername())
                        .header("X-Consumer-Username", "koduck-auth"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.getId()))
                .andExpect(jsonPath("$.username").value(request.getUsername()));
    }

    @Test
    void shouldPersistLastLoginUpdateViaInternalController() throws Exception {
        String unique = String.valueOf(System.nanoTime());
        User user = userRepository.save(User.builder()
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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(request.getLoginTime(), reloaded.getLastLoginAt());
        assertEquals(request.getIpAddress(), reloaded.getLastLoginIp());
    }
}
