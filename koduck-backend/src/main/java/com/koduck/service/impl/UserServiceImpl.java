package com.koduck.service.impl;
import com.koduck.dto.common.PageResponse;
import com.koduck.dto.user.*;
import com.koduck.entity.User;
import com.koduck.exception.BusinessException;
import com.koduck.exception.DuplicateException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.PermissionRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.repository.UserRoleRepository;
import com.koduck.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import java.util.List;
import java.util.stream.Collectors;
import static com.koduck.util.ServiceValidationUtils.requireFound;
/**
 * 用户服务实现类。
 */
@Slf4j
@Service
public class UserServiceImpl implements UserService {
    @org.springframework.beans.factory.annotation.Autowired
    private UserRepository userRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private RoleRepository roleRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private PermissionRepository permissionRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private UserRoleRepository userRoleRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private PasswordEncoder passwordEncoder;
    private static final int DEFAULT_ROLE_ID = 2; // USER
    /**
     * {@inheritDoc}
     */
    @Override
    public UserDetailResponse getCurrentUser(Long userId) {
        User user = loadUserOrThrow(userId);
        return convertToDetailResponse(user);
    }
    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public UserDetailResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = loadUserOrThrow(userId);
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
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = loadUserOrThrow(userId);
        // 验证旧密码
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.USER_OLD_PASSWORD_INCORRECT);
        }
        // 验证新密码与确认密码一致
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.AUTH_PASSWORD_MISMATCH);
        }
        // 更新密码
        userRepository.updatePassword(userId, passwordEncoder.encode(request.getNewPassword()));
    }
    /**
     * {@inheritDoc}
     */
    @Override
    public PageResponse<UserDetailResponse> listUsers(UserPageRequest request) {
        Pageable pageable = PageRequest.of(
                request.getPage() - 1,
                request.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );
        Page<User> userPage;
        if (StringUtils.hasText(request.getKeyword())) {
            // 根据关键词搜索（用户名或邮箱）
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
     * {@inheritDoc}
     */
    @Override
    public UserDetailResponse getUserById(Long userId) {
        User user = loadUserOrThrow(userId);
        return convertToDetailResponse(user);
    }
    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public UserDetailResponse createUser(CreateUserRequest request) {
        // 检查用户名是否已存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);
        }
        // 检查邮箱是否已存在
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);
        }
        // 创建用户实体
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
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public UserDetailResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = loadUserOrThrow(userId);
        // 更新邮箱（如果变更且不为空）
        if (StringUtils.hasText(request.getEmail()) && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);
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
        // 更新角色关联
        if (request.getRoleIds() != null) {
            userRoleRepository.deleteAllByUserId(userId);
            for (Integer roleId : request.getRoleIds()) {
                userRoleRepository.insertUserRole(userId, roleId);
            }
        }
        return convertToDetailResponse(user);
    }
    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteUser(Long userId, Long currentUserId) {
        // 防止自删
        if (userId.equals(currentUserId)) {
            throw new BusinessException(ErrorCode.USER_CANNOT_DELETE_SELF);
        }
        User user = loadUserOrThrow(userId);
        // 删除用户角色关联
        userRoleRepository.deleteAllByUserId(userId);
        // 删除用户
        userRepository.delete(user);
    }
    private User loadUserOrThrow(Long userId) {
        return requireFound(userRepository.findById(userId),
                () -> new ResourceNotFoundException("用户", userId));
    }
    /**
     * 将用户实体转换为详情响应对象。
     *
     * @param user 用户实体
     * @return 用户详情响应
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
