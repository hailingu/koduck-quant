package com.koduck.controller.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.koduck.dto.user.common.PageResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.user.CreateUserRequest;
import com.koduck.dto.user.user.LastLoginUpdateRequest;
import com.koduck.dto.user.user.UpdateProfileRequest;
import com.koduck.dto.user.user.UpdateUserRequest;
import com.koduck.dto.user.user.UserDetailsResponse;
import com.koduck.dto.user.user.UserProfileResponse;
import com.koduck.dto.user.user.UserSummaryResponse;
import com.koduck.exception.EmailAlreadyExistsException;
import com.koduck.exception.GlobalExceptionHandler;
import com.koduck.exception.UserNotFoundException;
import com.koduck.exception.UsernameAlreadyExistsException;
import com.koduck.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InternalUserControllerTest {

    private static final String DEFAULT_TENANT_ID = "default";
    private static final String TENANT_ID = "tenant-a";

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private StubUserService userService;

    @BeforeEach
    void setUp() {
        userService = new StubUserService();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        mockMvc = MockMvcBuilders
                .standaloneSetup(new InternalUserController(userService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldFindUserByUsername() throws Exception {
        userService.userByUsername = Optional.of(UserDetailsResponse.builder()
                .id(1001L)
                .username("alice")
                .email("alice@koduck.com")
                .passwordHash("hash")
                .status("ACTIVE")
                .build());

        mockMvc.perform(get("/internal/users/by-username/alice")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1001))
                .andExpect(jsonPath("$.username").value("alice"));
        org.junit.jupiter.api.Assertions.assertEquals(TENANT_ID, userService.lastTenantId);
    }

    @Test
    void shouldReturn404WhenUserByUsernameNotFound() throws Exception {
        userService.userByUsername = Optional.empty();

        mockMvc.perform(get("/internal/users/by-username/missing")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldFallbackToDefaultTenantWhenTenantHeaderMissing() throws Exception {
        userService.userByUsername = Optional.of(UserDetailsResponse.builder()
                .id(1001L)
                .username("alice")
                .email("alice@koduck.com")
                .passwordHash("hash")
                .status("ACTIVE")
                .build());

        mockMvc.perform(get("/internal/users/by-username/alice")
                        .header("X-Consumer-Username", "koduck-auth"))
                .andExpect(status().isOk());

        org.junit.jupiter.api.Assertions.assertEquals(DEFAULT_TENANT_ID, userService.lastTenantId);
    }

    @Test
    void shouldReturn401WhenConsumerHeaderMissing() throws Exception {
        mockMvc.perform(get("/internal/users/by-username/alice"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("缺少内部调用身份信息: X-Consumer-Username"));
    }

    @Test
    void shouldFindUserByEmail() throws Exception {
        userService.userByEmail = Optional.of(UserDetailsResponse.builder()
                .id(1002L)
                .username("bob")
                .email("bob@koduck.com")
                .passwordHash("hash")
                .status("ACTIVE")
                .build());

        mockMvc.perform(get("/internal/users/by-email/bob@koduck.com")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1002))
                .andExpect(jsonPath("$.email").value("bob@koduck.com"));
    }

    @Test
    void shouldReturn404WhenUserByEmailNotFound() throws Exception {
        userService.userByEmail = Optional.empty();

        mockMvc.perform(get("/internal/users/by-email/missing@koduck.com")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldCreateUser() throws Exception {
        CreateUserRequest request = CreateUserRequest.builder()
                .username("carol")
                .email("carol@koduck.com")
                .passwordHash("hash")
                .nickname("Carol")
                .status("ACTIVE")
                .build();
        userService.createdUser = UserDetailsResponse.builder()
                .id(1003L)
                .username("carol")
                .email("carol@koduck.com")
                .passwordHash("hash")
                .nickname("Carol")
                .status("ACTIVE")
                .build();

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1003))
                .andExpect(jsonPath("$.username").value("carol"));
    }

    @Test
    void shouldReturn400WhenCreateUserInvalid() throws Exception {
        CreateUserRequest request = CreateUserRequest.builder()
                .username("")
                .email("invalid-email")
                .passwordHash("")
                .build();

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn409WhenCreateUserUsernameConflict() throws Exception {
        CreateUserRequest request = CreateUserRequest.builder()
                .username("duplicated")
                .email("new@koduck.com")
                .passwordHash("hash")
                .build();
        userService.conflictUsername = "duplicated";

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("用户名已存在: duplicated"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void shouldReturn409WhenCreateUserEmailConflict() throws Exception {
        CreateUserRequest request = CreateUserRequest.builder()
                .username("new-user")
                .email("duplicated@koduck.com")
                .passwordHash("hash")
                .build();
        userService.conflictEmail = "duplicated@koduck.com";

        mockMvc.perform(post("/internal/users")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("邮箱已被使用: duplicated@koduck.com"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void shouldUpdateLastLogin() throws Exception {
        LastLoginUpdateRequest request = LastLoginUpdateRequest.builder()
                .loginTime(LocalDateTime.of(2026, 4, 9, 10, 30, 0))
                .ipAddress("127.0.0.1")
                .build();

        mockMvc.perform(put("/internal/users/1001/last-login")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn404WhenUpdateLastLoginUserNotFound() throws Exception {
        LastLoginUpdateRequest request = LastLoginUpdateRequest.builder()
                .loginTime(LocalDateTime.of(2026, 4, 9, 10, 30, 0))
                .ipAddress("127.0.0.1")
                .build();
        userService.notFoundUserIds = Set.of(9999L);

        mockMvc.perform(put("/internal/users/9999/last-login")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("用户不存在: id=9999"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void shouldGetUserRoles() throws Exception {
        userService.roles = List.of("ROLE_USER", "ROLE_ADMIN");

        mockMvc.perform(get("/internal/users/1001/roles")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("ROLE_USER"))
                .andExpect(jsonPath("$[1]").value("ROLE_ADMIN"));
    }

    @Test
    void shouldReturn404WhenGetUserRolesUserNotFound() throws Exception {
        userService.notFoundUserIds = Set.of(9999L);

        mockMvc.perform(get("/internal/users/9999/roles")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("用户不存在: id=9999"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void shouldGetUserPermissions() throws Exception {
        userService.permissions = List.of("user:read", "user:write");

        mockMvc.perform(get("/internal/users/1001/permissions")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("user:read"))
                .andExpect(jsonPath("$[1]").value("user:write"));
    }

    @Test
    void shouldReturn404WhenGetUserPermissionsUserNotFound() throws Exception {
        userService.notFoundUserIds = Set.of(9999L);

        mockMvc.perform(get("/internal/users/9999/permissions")
                        .header("X-Consumer-Username", "koduck-auth")
                        .header("X-Tenant-Id", TENANT_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("用户不存在: id=9999"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    static class StubUserService implements UserService {

        private Optional<UserDetailsResponse> userByUsername = Optional.empty();
        private Optional<UserDetailsResponse> userByEmail = Optional.empty();
        private String lastTenantId;
        private UserDetailsResponse createdUser;
        private List<String> roles = List.of();
        private List<String> permissions = List.of();
        private String conflictUsername;
        private String conflictEmail;
        private Set<Long> notFoundUserIds = Set.of();

        @Override
        public UserProfileResponse getCurrentUser(String tenantId, Long currentUserId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public UserProfileResponse updateProfile(String tenantId, Long currentUserId, UpdateProfileRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getCurrentUserPermissions(String tenantId, Long currentUserId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public PageResponse<UserSummaryResponse> searchUsers(String tenantId, String keyword, String status, Pageable pageable) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public UserProfileResponse getUserById(String tenantId, Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public UserProfileResponse updateUser(String tenantId, Long userId, UpdateUserRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void deleteUser(String tenantId, Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void assignRole(String tenantId, Long userId, Integer roleId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void removeRole(String tenantId, Long userId, Integer roleId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<RoleInfo> getUserRolesInfo(String tenantId, Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public Optional<UserDetailsResponse> findByUsername(String tenantId, String username) {
            this.lastTenantId = tenantId;
            return userByUsername;
        }

        @Override
        public Optional<UserDetailsResponse> findByEmail(String tenantId, String email) {
            this.lastTenantId = tenantId;
            return userByEmail;
        }

        @Override
        public UserDetailsResponse createUser(String tenantId, CreateUserRequest request) {
            this.lastTenantId = tenantId;
            if (request.getUsername() != null && request.getUsername().equals(conflictUsername)) {
                throw new UsernameAlreadyExistsException(request.getUsername());
            }
            if (request.getEmail() != null && request.getEmail().equals(conflictEmail)) {
                throw new EmailAlreadyExistsException(request.getEmail());
            }
            return createdUser;
        }

        @Override
        public void updateLastLogin(String tenantId, Long userId, LastLoginUpdateRequest request) {
            this.lastTenantId = tenantId;
            if (notFoundUserIds.contains(userId)) {
                throw new UserNotFoundException(userId);
            }
        }

        @Override
        public List<String> getUserRoles(String tenantId, Long userId) {
            this.lastTenantId = tenantId;
            if (notFoundUserIds.contains(userId)) {
                throw new UserNotFoundException(userId);
            }
            return roles;
        }

        @Override
        public List<String> getUserPermissions(String tenantId, Long userId) {
            this.lastTenantId = tenantId;
            if (notFoundUserIds.contains(userId)) {
                throw new UserNotFoundException(userId);
            }
            return permissions;
        }
    }
}
