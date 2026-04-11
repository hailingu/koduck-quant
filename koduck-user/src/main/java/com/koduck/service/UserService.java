package com.koduck.service;

import com.koduck.dto.user.common.PageResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.user.CreateUserRequest;
import com.koduck.dto.user.user.LastLoginUpdateRequest;
import com.koduck.dto.user.user.UpdateProfileRequest;
import com.koduck.dto.user.user.UpdateUserRequest;
import com.koduck.dto.user.user.UserDetailsResponse;
import com.koduck.dto.user.user.UserProfileResponse;
import com.koduck.dto.user.user.UserSummaryResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/**
 * 用户服务接口。
 *
 * <p>覆盖公开 API（当前用户操作、管理员操作）和内部 API（供 koduck-auth 调用）的业务逻辑。</p>
 */
public interface UserService {

    // === 公开 API: 当前用户 ===

    UserProfileResponse getCurrentUser(String tenantId, Long currentUserId);

    UserProfileResponse updateProfile(String tenantId, Long currentUserId, UpdateProfileRequest request);

    List<String> getCurrentUserPermissions(String tenantId, Long currentUserId);

    // === 公开 API: 管理员 ===

    PageResponse<UserSummaryResponse> searchUsers(String tenantId, String keyword, String status, Pageable pageable);

    UserProfileResponse getUserById(String tenantId, Long userId);

    UserProfileResponse updateUser(String tenantId, Long userId, UpdateUserRequest request);

    void deleteUser(String tenantId, Long userId);

    void assignRole(String tenantId, Long userId, Integer roleId);

    void removeRole(String tenantId, Long userId, Integer roleId);

    List<RoleInfo> getUserRolesInfo(String tenantId, Long userId);

    // === 内部 API ===

    Optional<UserDetailsResponse> findById(String tenantId, Long userId);

    Optional<UserDetailsResponse> findByUsername(String tenantId, String username);

    Optional<UserDetailsResponse> findByEmail(String tenantId, String email);

    UserDetailsResponse createUser(String tenantId, CreateUserRequest request);

    void updateLastLogin(String tenantId, Long userId, LastLoginUpdateRequest request);

    List<String> getUserRoles(String tenantId, Long userId);

    List<String> getUserPermissions(String tenantId, Long userId);
}
