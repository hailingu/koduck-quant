package com.koduck.service.impl;

import com.koduck.dto.user.common.PageResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.user.CreateUserRequest;
import com.koduck.dto.user.user.LastLoginUpdateRequest;
import com.koduck.dto.user.user.UpdateProfileRequest;
import com.koduck.dto.user.user.UpdateUserRequest;
import com.koduck.dto.user.user.UserDetailsResponse;
import com.koduck.dto.user.user.UserProfileResponse;
import com.koduck.dto.user.user.UserSummaryResponse;
import com.koduck.entity.user.Role;
import com.koduck.entity.user.User;
import com.koduck.entity.user.UserRole;
import com.koduck.entity.user.UserStatus;
import com.koduck.exception.EmailAlreadyExistsException;
import com.koduck.exception.RoleNotFoundException;
import com.koduck.exception.UserNotFoundException;
import com.koduck.exception.UsernameAlreadyExistsException;
import com.koduck.repository.user.RoleRepository;
import com.koduck.repository.user.UserRepository;
import com.koduck.repository.user.UserRoleRepository;
import com.koduck.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;

@Service
public class UserServiceImpl implements UserService {

    private static final String DEFAULT_TENANT_ID = User.DEFAULT_TENANT_ID;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    public UserServiceImpl(UserRepository userRepository,
                           RoleRepository roleRepository,
                           UserRoleRepository userRoleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
    }

    // === 公开 API: 当前用户 ===

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUser(String tenantId, Long currentUserId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        User user = findUserOrThrow(resolvedTenantId, currentUserId);
        List<RoleInfo> roles = getUserRolesInfo(resolvedTenantId, currentUserId);
        return buildUserProfileResponse(user, roles);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(String tenantId, Long currentUserId, UpdateProfileRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);
        User user = findUserOrThrow(resolvedTenantId, currentUserId);

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByTenantIdAndEmail(resolvedTenantId, request.getEmail())) {
                throw new EmailAlreadyExistsException(request.getEmail());
            }
            user.setEmail(request.getEmail());
            user.setEmailVerifiedAt(null);
        }

        if (request.getNickname() != null) {
            user.setNickname(request.getNickname());
        }

        User saved = userRepository.save(user);
        List<RoleInfo> roles = getUserRolesInfo(resolvedTenantId, saved.getId());
        return buildUserProfileResponse(saved, roles);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getCurrentUserPermissions(String tenantId, Long currentUserId) {
        return userRoleRepository.findPermissionsByTenantIdAndUserId(resolveTenantId(tenantId), currentUserId);
    }

    // === 公开 API: 管理员 ===

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserSummaryResponse> searchUsers(String tenantId, String keyword, String status, Pageable pageable) {
        String resolvedTenantId = resolveTenantId(tenantId);
        Page<User> users;

        if (StringUtils.hasText(keyword)) {
            users = userRepository.searchByTenantIdAndKeyword(resolvedTenantId, keyword, pageable);
        } else if (StringUtils.hasText(status)) {
            users = userRepository.findByTenantIdAndStatus(resolvedTenantId, UserStatus.valueOf(status), pageable);
        } else {
            users = userRepository.findByTenantId(resolvedTenantId, pageable);
        }

        Page<UserSummaryResponse> mapped = users.map(this::buildUserSummaryResponse);
        return PageResponse.<UserSummaryResponse>builder()
                .content(mapped.getContent())
                .pageNumber(mapped.getNumber())
                .pageSize(mapped.getSize())
                .totalElements(mapped.getTotalElements())
                .totalPages(mapped.getTotalPages())
                .first(mapped.isFirst())
                .last(mapped.isLast())
                .empty(mapped.isEmpty())
                .numberOfElements(mapped.getNumberOfElements())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getUserById(String tenantId, Long userId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        User user = findUserOrThrow(resolvedTenantId, userId);
        List<RoleInfo> roles = getUserRolesInfo(resolvedTenantId, userId);
        return buildUserProfileResponse(user, roles);
    }

    @Override
    @Transactional
    public UserProfileResponse updateUser(String tenantId, Long userId, UpdateUserRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);
        User user = findUserOrThrow(resolvedTenantId, userId);

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByTenantIdAndEmail(resolvedTenantId, request.getEmail())) {
                throw new EmailAlreadyExistsException(request.getEmail());
            }
            user.setEmail(request.getEmail());
            user.setEmailVerifiedAt(null);
        }

        if (request.getNickname() != null) {
            user.setNickname(request.getNickname());
        }

        if (request.getStatus() != null) {
            user.setStatus(UserStatus.valueOf(request.getStatus()));
        }

        User saved = userRepository.save(user);
        List<RoleInfo> roles = getUserRolesInfo(resolvedTenantId, saved.getId());
        return buildUserProfileResponse(saved, roles);
    }

    @Override
    @Transactional
    public void deleteUser(String tenantId, Long userId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        if (userRepository.findByIdAndTenantId(userId, resolvedTenantId).isEmpty()) {
            throw new UserNotFoundException(userId);
        }
        userRepository.deleteById(userId);
    }

    @Override
    @Transactional
    public void assignRole(String tenantId, Long userId, Integer roleId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findUserOrThrow(resolvedTenantId, userId);

        if (roleRepository.findByIdAndTenantId(roleId, resolvedTenantId).isEmpty()) {
            throw new RoleNotFoundException(roleId);
        }

        if (userRoleRepository.existsByTenantIdAndUserIdAndRoleId(resolvedTenantId, userId, roleId)) {
            return;
        }

        UserRole userRole = UserRole.builder()
                .tenantId(resolvedTenantId)
                .userId(userId)
                .roleId(roleId)
                .build();

        userRoleRepository.save(userRole);
    }

    @Override
    @Transactional
    public void removeRole(String tenantId, Long userId, Integer roleId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findUserOrThrow(resolvedTenantId, userId);

        if (roleRepository.findByIdAndTenantId(roleId, resolvedTenantId).isEmpty()) {
            throw new RoleNotFoundException(roleId);
        }

        userRoleRepository.deleteByTenantIdAndUserIdAndRoleId(resolvedTenantId, userId, roleId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoleInfo> getUserRolesInfo(String tenantId, Long userId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        List<Integer> roleIds = userRoleRepository.findRoleIdsByTenantIdAndUserId(resolvedTenantId, userId);
        return roleIds.stream()
                .map(roleId -> roleRepository.findByIdAndTenantId(roleId, resolvedTenantId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(this::buildRoleInfo)
                .toList();
    }

    // === 内部 API ===

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetailsResponse> findByUsername(String tenantId, String username) {
        return userRepository.findByTenantIdAndUsername(resolveTenantId(tenantId), username)
                .map(this::buildUserDetailsResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetailsResponse> findByEmail(String tenantId, String email) {
        return userRepository.findByTenantIdAndEmail(resolveTenantId(tenantId), email)
                .map(this::buildUserDetailsResponse);
    }

    @Override
    @Transactional
    public UserDetailsResponse createUser(String tenantId, CreateUserRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);

        if (userRepository.existsByTenantIdAndUsername(resolvedTenantId, request.getUsername())) {
            throw new UsernameAlreadyExistsException(request.getUsername());
        }

        if (userRepository.existsByTenantIdAndEmail(resolvedTenantId, request.getEmail())) {
            throw new EmailAlreadyExistsException(request.getEmail());
        }

        UserStatus status = UserStatus.ACTIVE;
        if (StringUtils.hasText(request.getStatus())) {
            status = UserStatus.valueOf(request.getStatus());
        }

        User user = User.builder()
                .tenantId(resolvedTenantId)
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(request.getPasswordHash())
                .nickname(request.getNickname())
                .status(status)
                .build();

        User saved = userRepository.save(user);
        Role defaultRole = roleRepository.findByTenantIdAndName(resolvedTenantId, "ROLE_USER")
                .orElseThrow(() -> new RoleNotFoundException("ROLE_USER"));
        if (!userRoleRepository.existsByTenantIdAndUserIdAndRoleId(resolvedTenantId, saved.getId(), defaultRole.getId())) {
            userRoleRepository.save(UserRole.builder()
                    .tenantId(resolvedTenantId)
                    .userId(saved.getId())
                    .roleId(defaultRole.getId())
                    .build());
        }
        return buildUserDetailsResponse(saved);
    }

    @Override
    @Transactional
    public void updateLastLogin(String tenantId, Long userId, LastLoginUpdateRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findUserOrThrow(resolvedTenantId, userId);
        userRepository.updateLastLogin(resolvedTenantId, userId, request.getLoginTime(), request.getIpAddress());
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getUserRoles(String tenantId, Long userId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findUserOrThrow(resolvedTenantId, userId);
        List<Integer> roleIds = userRoleRepository.findRoleIdsByTenantIdAndUserId(resolvedTenantId, userId);
        return roleIds.stream()
                .map(roleId -> roleRepository.findByIdAndTenantId(roleId, resolvedTenantId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(Role::getName)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getUserPermissions(String tenantId, Long userId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findUserOrThrow(resolvedTenantId, userId);
        return userRoleRepository.findPermissionsByTenantIdAndUserId(resolvedTenantId, userId);
    }

    // === 私有辅助方法 ===

    private User findUserOrThrow(Long userId) {
        return findUserOrThrow(DEFAULT_TENANT_ID, userId);
    }

    private User findUserOrThrow(String tenantId, Long userId) {
        return userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new UserNotFoundException(userId));
    }

    private String resolveTenantId(String tenantId) {
        return StringUtils.hasText(tenantId) ? tenantId : DEFAULT_TENANT_ID;
    }

    private UserProfileResponse buildUserProfileResponse(User user, List<RoleInfo> roles) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus().name())
                .emailVerifiedAt(user.getEmailVerifiedAt())
                .lastLoginAt(user.getLastLoginAt())
                .roles(roles)
                .createdAt(user.getCreatedAt())
                .build();
    }

    private UserSummaryResponse buildUserSummaryResponse(User user) {
        return UserSummaryResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .status(user.getStatus().name())
                .createdAt(user.getCreatedAt())
                .build();
    }

    private UserDetailsResponse buildUserDetailsResponse(User user) {
        return UserDetailsResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .passwordHash(user.getPasswordHash())
                .nickname(user.getNickname())
                .status(user.getStatus().name())
                .createdAt(user.getCreatedAt())
                .build();
    }

    private RoleInfo buildRoleInfo(Role role) {
        return RoleInfo.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .build();
    }
}
