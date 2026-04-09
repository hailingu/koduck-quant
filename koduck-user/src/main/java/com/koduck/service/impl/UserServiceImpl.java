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
    public UserProfileResponse getCurrentUser(Long currentUserId) {
        User user = findUserOrThrow(currentUserId);
        List<RoleInfo> roles = getUserRolesInfo(currentUserId);
        return buildUserProfileResponse(user, roles);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(Long currentUserId, UpdateProfileRequest request) {
        User user = findUserOrThrow(currentUserId);

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new EmailAlreadyExistsException(request.getEmail());
            }
            user.setEmail(request.getEmail());
            user.setEmailVerifiedAt(null);
        }

        if (request.getNickname() != null) {
            user.setNickname(request.getNickname());
        }

        User saved = userRepository.save(user);
        List<RoleInfo> roles = getUserRolesInfo(saved.getId());
        return buildUserProfileResponse(saved, roles);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getCurrentUserPermissions(Long currentUserId) {
        return userRoleRepository.findPermissionsByUserId(currentUserId);
    }

    // === 公开 API: 管理员 ===

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserSummaryResponse> searchUsers(String keyword, String status, Pageable pageable) {
        Page<User> users;

        if (StringUtils.hasText(keyword)) {
            users = userRepository.findByUsernameContainingOrEmailContaining(
                    keyword, keyword, pageable);
        } else if (StringUtils.hasText(status)) {
            users = userRepository.findByStatus(UserStatus.valueOf(status), pageable);
        } else {
            users = userRepository.findAll(pageable);
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
    public UserProfileResponse getUserById(Long userId) {
        User user = findUserOrThrow(userId);
        List<RoleInfo> roles = getUserRolesInfo(userId);
        return buildUserProfileResponse(user, roles);
    }

    @Override
    @Transactional
    public UserProfileResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = findUserOrThrow(userId);

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
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
        List<RoleInfo> roles = getUserRolesInfo(saved.getId());
        return buildUserProfileResponse(saved, roles);
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException(userId);
        }
        userRepository.deleteById(userId);
    }

    @Override
    @Transactional
    public void assignRole(Long userId, Integer roleId) {
        findUserOrThrow(userId);

        if (!roleRepository.existsById(roleId)) {
            throw new RoleNotFoundException(roleId);
        }

        if (userRoleRepository.existsByUserIdAndRoleId(userId, roleId)) {
            return;
        }

        UserRole userRole = UserRole.builder()
                .userId(userId)
                .roleId(roleId)
                .build();

        userRoleRepository.save(userRole);
    }

    @Override
    @Transactional
    public void removeRole(Long userId, Integer roleId) {
        findUserOrThrow(userId);

        if (!roleRepository.existsById(roleId)) {
            throw new RoleNotFoundException(roleId);
        }

        userRoleRepository.deleteByUserIdAndRoleId(userId, roleId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoleInfo> getUserRolesInfo(Long userId) {
        List<Integer> roleIds = userRoleRepository.findRoleIdsByUserId(userId);
        return roleIds.stream()
                .map(roleId -> roleRepository.findById(roleId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(this::buildRoleInfo)
                .toList();
    }

    // === 内部 API ===

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetailsResponse> findByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(this::buildUserDetailsResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetailsResponse> findByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(this::buildUserDetailsResponse);
    }

    @Override
    @Transactional
    public UserDetailsResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new UsernameAlreadyExistsException(request.getUsername());
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException(request.getEmail());
        }

        UserStatus status = UserStatus.ACTIVE;
        if (StringUtils.hasText(request.getStatus())) {
            status = UserStatus.valueOf(request.getStatus());
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(request.getPasswordHash())
                .nickname(request.getNickname())
                .status(status)
                .build();

        User saved = userRepository.save(user);
        return buildUserDetailsResponse(saved);
    }

    @Override
    @Transactional
    public void updateLastLogin(Long userId, LastLoginUpdateRequest request) {
        findUserOrThrow(userId);
        userRepository.updateLastLogin(userId, request.getLoginTime(), request.getIpAddress());
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getUserRoles(Long userId) {
        findUserOrThrow(userId);
        List<Integer> roleIds = userRoleRepository.findRoleIdsByUserId(userId);
        return roleIds.stream()
                .map(roleId -> roleRepository.findById(roleId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(Role::getName)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getUserPermissions(Long userId) {
        findUserOrThrow(userId);
        return userRoleRepository.findPermissionsByUserId(userId);
    }

    // === 私有辅助方法 ===

    private User findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
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
