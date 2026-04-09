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

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        UserService userService = new StubUserService();
        PermissionService permissionService = new StubPermissionService();
        mockMvc = MockMvcBuilders
                .standaloneSetup(new UserController(userService, permissionService))
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
                        .header("X-Username", "demo")
                        .header("X-Roles", "ROLE_USER"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("权限不足，需要: user:read"));
    }

    private static class StubUserService implements UserService {

        @Override
        public UserProfileResponse getCurrentUser(Long currentUserId) {
            return UserProfileResponse.builder().id(currentUserId).username("demo").build();
        }

        @Override
        public UserProfileResponse updateProfile(Long currentUserId, UpdateProfileRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getCurrentUserPermissions(Long currentUserId) {
            return List.of();
        }

        @Override
        public PageResponse<UserSummaryResponse> searchUsers(String keyword, String status, Pageable pageable) {
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
        public UserProfileResponse getUserById(Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public UserProfileResponse updateUser(Long userId, UpdateUserRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void deleteUser(Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void assignRole(Long userId, Integer roleId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void removeRole(Long userId, Integer roleId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<RoleInfo> getUserRolesInfo(Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public Optional<UserDetailsResponse> findByUsername(String username) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public Optional<UserDetailsResponse> findByEmail(String email) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public UserDetailsResponse createUser(CreateUserRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public void updateLastLogin(Long userId, LastLoginUpdateRequest request) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getUserRoles(Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public List<String> getUserPermissions(Long userId) {
            throw new UnsupportedOperationException("Not used in this test");
        }
    }

    private static class StubPermissionService implements PermissionService {

        @Override
        public List<com.koduck.dto.user.permission.PermissionInfo> listPermissions() {
            return List.of();
        }

        @Override
        public List<String> getUserPermissions(Long userId) {
            return List.of();
        }
    }
}
