package com.koduck.service;

import com.koduck.dto.UserInfo;
import com.koduck.dto.auth.*;
import com.koduck.entity.RefreshToken;
import com.koduck.entity.User;
import com.koduck.exception.BusinessException;
import com.koduck.repository.*;
import com.koduck.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 认证服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRoleRepository userRoleRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    private static final int DEFAULT_ROLE_ID = 2; // USER 角色

    /**
     * 用户登录
     */
    @Transactional
    public TokenResponse login(LoginRequest request, String ipAddress, String userAgent) {
        // 查找用户（支持用户名或邮箱登录）
        User user = userRepository.findByUsername(request.getUsername())
                .orElseGet(() -> userRepository.findByEmail(request.getUsername())
                        .orElseThrow(() -> new BusinessException("用户名或密码错误")));

        // 检查用户状态
        if (user.getStatus() == User.UserStatus.DISABLED) {
            throw new BusinessException("账号已被禁用");
        }

        // 验证密码
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("用户名或密码错误");
        }

        // 更新最后登录信息
        userRepository.updateLastLogin(user.getId(), LocalDateTime.now(), ipAddress);

        // 生成 Token
        return generateTokenResponse(user);
    }

    /**
     * 用户注册
     */
    @Transactional
    public TokenResponse register(RegisterRequest request) {
        // 检查用户名是否已存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("用户名已被使用");
        }

        // 检查邮箱是否已存在
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("邮箱已被注册");
        }

        // 检查密码是否一致
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("两次输入的密码不一致");
        }

        // 创建用户
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname() != null ? request.getNickname() : request.getUsername())
                .status(User.UserStatus.ACTIVE)
                .build();

        user = userRepository.save(user);

        // 分配默认角色（USER）
        userRoleRepository.insertUserRole(user.getId(), DEFAULT_ROLE_ID);

        // 生成 Token
        return generateTokenResponse(user);
    }

    /**
     * 刷新 Token
     */
    @Transactional
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        String refreshTokenValue = request.getRefreshToken();

        // 验证 Refresh Token 格式
        if (!jwtUtil.validateToken(refreshTokenValue) || !jwtUtil.isRefreshToken(refreshTokenValue)) {
            throw new BusinessException("无效的刷新令牌");
        }

        // 计算 Token Hash
        String tokenHash = hashToken(refreshTokenValue);

        // 查询数据库中的 Refresh Token
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("刷新令牌不存在或已失效"));

        // 检查是否过期
        if (refreshToken.isExpired()) {
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw new BusinessException("刷新令牌已过期");
        }

        // 获取用户信息
        User user = userRepository.findById(refreshToken.getUserId())
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 删除旧的 Refresh Token
        refreshTokenRepository.deleteByTokenHash(tokenHash);

        // 生成新的 Token
        return generateTokenResponse(user);
    }

    /**
     * 用户登出
     */
    @Transactional
    public void logout(String refreshTokenValue) {
        if (refreshTokenValue != null) {
            String tokenHash = hashToken(refreshTokenValue);
            refreshTokenRepository.deleteByTokenHash(tokenHash);
        }
    }

    /**
     * 获取安全配置
     */
    public SecurityConfigResponse getSecurityConfig() {
        return SecurityConfigResponse.builder()
                .turnstileEnabled(false)  // 可根据配置调整
                .turnstileSiteKey("")
                .registrationEnabled(true)
                .oauthGoogleEnabled(false)
                .oauthGithubEnabled(false)
                .build();
    }

    /**
     * 生成 Token 响应
     */
    private TokenResponse generateTokenResponse(User user) {
        // 查询用户角色
        List<String> roleNames = roleRepository.findRoleNamesByUserId(user.getId());

        // 生成 Access Token
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), user.getEmail());

        // 生成 Refresh Token
        String refreshToken = jwtUtil.generateRefreshToken(user.getId());

        // 保存 Refresh Token
        RefreshToken tokenEntity = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(hashToken(refreshToken))
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        refreshTokenRepository.save(tokenEntity);

        // 构建 UserInfo
        UserInfo userInfo = UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleNames)
                .build();

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(86400L) // 24小时
                .tokenType("Bearer")
                .user(userInfo)
                .build();
    }

    /**
     * 计算 Token 的 Hash（用于存储）
     */
    private String hashToken(String token) {
        // 使用 SHA-256 或截取部分 token + salt
        // 简化处理：使用 UUID 的 hashCode 或直接存储 token 的 hash
        return UUID.nameUUIDFromBytes(token.getBytes()).toString();
    }
}
