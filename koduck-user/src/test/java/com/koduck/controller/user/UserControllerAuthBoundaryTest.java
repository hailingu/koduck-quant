package com.koduck.controller.user;

import com.koduck.dto.user.common.PageResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.user.CreateUserRequest;
import com.koduck.dto.user.user.LastLoginUpdateRequest;
import com.koduck.dto.user.user.UpdateProfileRequest;
import com.koduck.dto.user.user.UpdateUserRequest;
import com.koduck.dto.user.user.UserDetailsResponse;
import com.koduck.dto.user.user.UserProfileResponse;
import com.koduck.dto.user.user.UserSummaryResponse;
import com.koduck.exception.GlobalExceptionHandler;
import com.koduck.service.AvatarStorageService;
import com.koduck.service.PermissionService;
import com.koduck.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerAuthBoundaryTest {

    private static final String TENANT_ID = "tenant-a";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        UserService userService = new StubUserService();
        PermissionService permissionService = new StubPermissionService();
        AvatarStorageService avatarStorageService = org.mockito.Mockito.mock(AvatarStorageService.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new UserController(userService, permissionService, avatarStorageService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldReturn401WhenPublicApiMissingUserContext() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("缺少用户身份信息: X-User-Id"));
    }

    @Test
    void shouldReturn403WhenPermissionInsufficientOnManagedApi() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .header("X-User-Id", "1001")
                        .header("X-Tenant-Id", TENANT_ID)
                        .header("X-Username", "demo")
                        .header("X-Roles", "ROLE_USER"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("权限不足，需要: user:read"));
    }

    private static class StubUserService implements UserService {

        @Override
        public UserProfileResponse getCurrentUser(String tenantId, Long currentUserId) {
            return UserProfileResponse.builder().id(currentUserId).username("demo").build();
        }

        @Override
        public UserProfileResponse updateProfile(String tenantId, Long currentUserId, UpdateProfileRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public com.koduck.dto.user.user.AvatarUploadResponse uploadAvatar(String tenantId,
                                                                          Long currentUserId,
                                                                          org.springframework.web.multipart.MultipartFile file) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getCurrentUserPermissions(String tenantId, Long currentUserId) {
            return List.of();
        }

        @Override
        public PageResponse<UserSummaryResponse> searchUsers(String tenantId, String keyword, String status, Pageable pageable) {
            return PageResponse.<UserSummaryResponse>builder()
                    .content(List.of())
                    .pageNumber(0)
                    .pageSize(20)
                    .totalElements(0)
                    .totalPages(0)
                    .first(true)
                    .last(true)
                    .build();
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
        public Optional<UserDetailsResponse> findById(String tenantId, Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public Optional<UserDetailsResponse> findByUsername(String tenantId, String username) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public Optional<UserDetailsResponse> findByEmail(String tenantId, String email) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public UserDetailsResponse createUser(String tenantId, CreateUserRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void updateLastLogin(String tenantId, Long userId, LastLoginUpdateRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getUserRoles(String tenantId, Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getUserPermissions(String tenantId, Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }
    }

    private static class StubPermissionService implements PermissionService {

        @Override
        public List<com.koduck.dto.user.permission.PermissionInfo> listPermissions() {
            return List.of();
        }

        @Override
        public List<String> getUserPermissions(String tenantId, Long userId) {
            return List.of();
        }
    }
}
