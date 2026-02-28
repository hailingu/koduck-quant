package com.koduck.service;

import com.koduck.dto.common.PageResponse;
import com.koduck.dto.user.*;
import com.koduck.entity.User;
import com.koduck.exception.BusinessException;
import com.koduck.repository.PermissionRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 用户服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    private static final int DEFAULT_ROLE_ID = 2; // USER 角色

    /**
     * 获取当前用户信息
     */
    public UserDetailResponse getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));
        return convertToDetailResponse(user);
    }

    /**
     * 更新当前用户资料
     */
    @Transactional
    public UserDetailResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        if (StringUtils.hasText(request.getNickname())) {
            user.setNickname(request.getNickname());
        }
        if (StringUtils.hasText(request.getAvatarUrl())) {
            user.setAvatarUrl(request.getAvatarUrl());
        }

        user = userRepository.save(user);
        return convertToDetailResponse(user);
    }

    /**
     * 修改密码
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 验证旧密码
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new BusinessException("旧密码错误");
        }

        // 验证新密码和确认密码
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("两次输入的新密码不一致");
        }

        // 更新密码
        userRepository.updatePassword(userId, passwordEncoder.encode(request.getNewPassword()));
    }

    /**
     * 分页查询用户列表（管理员）
     */
    public PageResponse<UserDetailResponse> listUsers(UserPageRequest request) {
        Pageable pageable = PageRequest.of(
                request.getPage() - 1,
                request.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<User> userPage;
        if (StringUtils.hasText(request.getKeyword())) {
            // 关键词搜索（用户名或邮箱）
            userPage = userRepository.findByUsernameContainingOrEmailContaining(
                    request.getKeyword(), request.getKeyword(), pageable);
        } else {
            userPage = userRepository.findAll(pageable);
        }

        List<UserDetailResponse> content = userPage.getContent().stream()
                .map(this::convertToDetailResponse)
                .collect(Collectors.toList());

        return PageResponse.<UserDetailResponse>builder()
                .content(content)
                .page(request.getPage())
                .size(request.getSize())
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .first(userPage.isFirst())
                .last(userPage.isLast())
                .build();
    }

    /**
     * 获取用户详情（管理员）
     */
    public UserDetailResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));
        return convertToDetailResponse(user);
    }

    /**
     * 创建用户（管理员）
     */
    @Transactional
    public UserDetailResponse createUser(CreateUserRequest request) {
        // 检查用户名是否已存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("用户名已被使用");
        }

        // 检查邮箱是否已存在
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("邮箱已被注册");
        }

        // 创建用户
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname() != null ? request.getNickname() : request.getUsername())
                .status(request.getStatus() != null ? request.getStatus() : User.UserStatus.ACTIVE)
                .build();

        user = userRepository.save(user);

        // 分配角色
        if (request.getRoleIds() != null && !request.getRoleIds().isEmpty()) {
            for (Integer roleId : request.getRoleIds()) {
                userRoleRepository.insertUserRole(user.getId(), roleId);
            }
        } else {
            // 分配默认角色
            userRoleRepository.insertUserRole(user.getId(), DEFAULT_ROLE_ID);
        }

        return convertToDetailResponse(user);
    }

    /**
     * 更新用户（管理员）
     */
    @Transactional
    public UserDetailResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 更新邮箱
        if (StringUtils.hasText(request.getEmail()) && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new BusinessException("邮箱已被注册");
            }
            user.setEmail(request.getEmail());
        }

        // 更新其他字段
        if (StringUtils.hasText(request.getNickname())) {
            user.setNickname(request.getNickname());
        }
        if (StringUtils.hasText(request.getAvatarUrl())) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
        }

        user = userRepository.save(user);

        // 更新角色
        if (request.getRoleIds() != null) {
            userRoleRepository.deleteAllByUserId(userId);
            for (Integer roleId : request.getRoleIds()) {
                userRoleRepository.insertUserRole(userId, roleId);
            }
        }

        return convertToDetailResponse(user);
    }

    /**
     * 删除用户（管理员）
     */
    @Transactional
    public void deleteUser(Long userId, Long currentUserId) {
        // 防止删除自己
        if (userId.equals(currentUserId)) {
            throw new BusinessException("不能删除自己");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 删除用户角色关联
        userRoleRepository.deleteAllByUserId(userId);

        // 删除用户
        userRepository.delete(user);
    }

    /**
     * 转换为详情响应
     */
    private UserDetailResponse convertToDetailResponse(User user) {
        List<String> roleNames = roleRepository.findRoleNamesByUserId(user.getId());
        List<String> permissionCodes = permissionRepository.findPermissionCodesByUserId(user.getId());

        return UserDetailResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .emailVerifiedAt(user.getEmailVerifiedAt())
                .lastLoginAt(user.getLastLoginAt())
                .lastLoginIp(user.getLastLoginIp())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .roles(roleNames)
                .permissions(permissionCodes)
                .build();
    }
}
