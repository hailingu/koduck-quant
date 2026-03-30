package com.koduck.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.AbstractIntegrationTest;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.dto.user.ChangePasswordRequest;
import com.koduck.dto.user.CreateUserRequest;
import com.koduck.dto.user.UpdateProfileRequest;
import com.koduck.dto.user.UpdateUserRequest;
import com.koduck.dto.user.UserDetailResponse;
import com.koduck.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UserController 
 */
@AutoConfigureMockMvc
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class UserControllerIntegrationTest extends AbstractIntegrationTest {

        private static final int ADMIN_ROLE_ID = 1;

        private final MockMvc mockMvc;
        private final ObjectMapper objectMapper;
        private final JdbcTemplate jdbcTemplate;

    private String accessToken;
    private String adminAccessToken;
    private Long normalUserId;
    private String normalUsername;

        UserControllerIntegrationTest(
                        MockMvc mockMvc,
                        ObjectMapper objectMapper,
                        JdbcTemplate jdbcTemplate) {
                this.mockMvc = mockMvc;
                this.objectMapper = objectMapper;
                this.jdbcTemplate = jdbcTemplate;
        }

    @BeforeEach
    void setUp() throws Exception {
        String suffix = String.valueOf(System.nanoTime());

        RegisteredUser normalUser = registerUser("testuser_" + suffix, "password123", "Test User");
        accessToken = normalUser.accessToken();
        normalUserId = normalUser.userId();
        normalUsername = normalUser.username();

        RegisteredUser adminUser = registerUser("adminuser_" + suffix, "password123", "Admin User");

        jdbcTemplate.update(
                "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                adminUser.userId(),
                ADMIN_ROLE_ID
        );

        adminAccessToken = loginAndGetAccessToken(adminUser.username(), "password123");
    }

    private RegisteredUser registerUser(String username, String password, String nickname) throws Exception {
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername(username);
        registerRequest.setEmail(username + "@example.com");
        registerRequest.setPassword(password);
        registerRequest.setConfirmPassword(password);
        registerRequest.setNickname(nickname);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<TokenResponse> response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, TokenResponse.class));

        TokenResponse tokenResponse = response.getData();
        return new RegisteredUser(tokenResponse.getAccessToken(), tokenResponse.getUser().getId(), username);
    }

    private String loginAndGetAccessToken(String username, String password) throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(username);
        loginRequest.setPassword(password);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<TokenResponse> response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, TokenResponse.class));
        return response.getData().getAccessToken();
    }

    private record RegisteredUser(String accessToken, Long userId, String username) {
    }

    @Test
    @DisplayName("获取当前用户信息")
    void getCurrentUser() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value(normalUsername))
                .andExpect(jsonPath("$.data.id").value(normalUserId));
    }

    @Test
    @DisplayName("更新当前用户资料")
    void updateProfile() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("Updated Nickname");
        request.setAvatarUrl("https://example.com/avatar.png");

        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.nickname").value("Updated Nickname"))
                .andExpect(jsonPath("$.data.avatarUrl").value("https://example.com/avatar.png"));
    }

    @Test
    @DisplayName("修改密码成功")
    void changePasswordSuccess() throws Exception {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setOldPassword("password123");
        request.setNewPassword("newpassword456");
        request.setConfirmPassword("newpassword456");

        mockMvc.perform(put("/api/v1/users/me/password")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // 
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(normalUsername);
        loginRequest.setPassword("newpassword456");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("修改密码失败-旧密码错误")
    void changePasswordWrongOldPassword() throws Exception {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setOldPassword("wrongpassword");
        request.setNewPassword("newpassword456");
        request.setConfirmPassword("newpassword456");

        mockMvc.perform(put("/api/v1/users/me/password")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(-1))
                .andExpect(jsonPath("$.message").value("旧密码错误"));
    }

    @Test
    @DisplayName("普通用户无法访问管理员接口")
    void normalUserCannotAccessAdminEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("未认证用户无法访问用户接口")
    void unauthenticatedUserCannotAccessUserEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("管理员可获取用户列表")
    void adminCanListUsers() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .param("page", "1")
                        .param("size", "10")
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.totalElements").isNumber());
    }

    @Test
    @DisplayName("管理员可获取指定用户详情")
    void adminCanGetUserById() throws Exception {
        mockMvc.perform(get("/api/v1/users/{id}", normalUserId)
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value(normalUserId))
                .andExpect(jsonPath("$.data.username").value(normalUsername));
    }

    @Test
    @DisplayName("管理员可创建并更新用户")
    void adminCanCreateAndUpdateUser() throws Exception {
        CreateUserRequest createRequest = new CreateUserRequest();
        createRequest.setUsername("managed_" + System.nanoTime());
        createRequest.setEmail(createRequest.getUsername() + "@example.com");
        createRequest.setPassword("password123");
        createRequest.setNickname("Managed User");
        createRequest.setStatus(User.UserStatus.ACTIVE);

        MvcResult createResult = mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value(createRequest.getUsername()))
                .andReturn();

        ApiResponse<UserDetailResponse> createResponse = objectMapper.readValue(
                createResult.getResponse().getContentAsString(StandardCharsets.UTF_8),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, UserDetailResponse.class));
        Long createdUserId = createResponse.getData().getId();

        UpdateUserRequest updateRequest = new UpdateUserRequest();
        updateRequest.setNickname("Managed User Updated");
        updateRequest.setAvatarUrl("https://example.com/managed.png");
        updateRequest.setStatus(User.UserStatus.ACTIVE);

        mockMvc.perform(put("/api/v1/users/{id}", createdUserId)
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value(createdUserId))
                .andExpect(jsonPath("$.data.nickname").value("Managed User Updated"));
    }

    @Test
    @DisplayName("管理员可删除其他用户")
    void adminCanDeleteOtherUser() throws Exception {
        RegisteredUser deletableUser = registerUser("deletable_" + System.nanoTime(), "password123", "Delete Me");

        mockMvc.perform(delete("/api/v1/users/{id}", deletableUser.userId())
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(get("/api/v1/users/{id}", deletableUser.userId())
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(-1));
    }
}
