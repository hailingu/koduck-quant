package com.koduck.service;

import com.koduck.config.properties.MailProperties;
import com.koduck.dto.UserInfo;
import com.koduck.dto.auth.*;
import com.koduck.entity.PasswordResetToken;
import com.koduck.entity.RefreshToken;
import com.koduck.entity.User;
import com.koduck.exception.AuthenticationException;
import com.koduck.exception.BusinessException;
import com.koduck.exception.DuplicateException;
import com.koduck.exception.ErrorCode;
import com.koduck.repository.*;
import com.koduck.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * 认证服务
 *
 * <p>提供用户登录、注册、Token 刷新、密码重置等认证相关功能。</p>
 *
 * @author Koduck Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final RateLimiterService rateLimiterService;
    private final MailProperties mailProperties;

    private static final int DEFAULT_ROLE_ID = 2; // USER 角色

    /**
     * 保留用户名列表（系统预设账号，不允许注册）
     */
    private static final List<String> RESERVED_USERNAMES = List.of(
            "admin", "administrator", "root", "system", "test", "guest", "demo"
    );

    /**
     * 令牌长度（URL-safe Base64）
     */
    private static final int RESET_TOKEN_LENGTH = 32;

    /**
     * 用户登录
     *
     * @param request    登录请求
     * @param ipAddress  IP地址
     * @param userAgent  用户代理
     * @return Token 响应
     */
    @Transactional
    public TokenResponse login(LoginRequest request, String ipAddress, String userAgent) {
        // 查找用户（支持用户名或邮箱登录）
        User user = userRepository.findByUsername(request.getUsername())
                .orElseGet(() -> userRepository.findByEmail(request.getUsername())
                        .orElseThrow(AuthenticationException::invalidCredentials));

        // 检查用户状态
        if (user.getStatus() == User.UserStatus.DISABLED) {
            throw AuthenticationException.accountDisabled();
        }

        // 验证密码
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw AuthenticationException.invalidCredentials();
        }

        // 更新最后登录信息
        userRepository.updateLastLogin(user.getId(), LocalDateTime.now(), ipAddress);

        // 生成 Token
        return generateTokenResponse(user);
    }

    /**
     * 用户注册
     *
     * @param request 注册请求
     * @return Token 响应
     */
    @Transactional
    public TokenResponse register(RegisterRequest request) {
        // 检查用户名是否为保留用户名（系统账号）
        if (RESERVED_USERNAMES.contains(request.getUsername().toLowerCase())) {
            throw new BusinessException(ErrorCode.USER_RESERVED_USERNAME);
        }

        // 检查用户名是否已存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);
        }

        // 检查邮箱是否已存在
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);
        }

        // 检查密码是否一致
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.AUTH_PASSWORD_MISMATCH);
        }

        // 创建用户
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname() != null ? request.getNickname() : request.getUsername())
                .status(User.UserStatus.ACTIVE)
                .build();

        @SuppressWarnings("null")
        User savedUser = Objects.requireNonNull(userRepository.save(user));

        // 分配默认角色（USER）
        userRoleRepository.insertUserRole(savedUser.getId(), DEFAULT_ROLE_ID);

        // 生成 Token
        return generateTokenResponse(savedUser);
    }

    /**
     * 刷新 Token
     *
     * @param request 刷新 Token 请求
     * @return Token 响应
     */
    @Transactional
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        String refreshTokenValue = request.getRefreshToken();

        // 验证 Refresh Token 格式
        if (!jwtUtil.validateToken(refreshTokenValue) || !jwtUtil.isRefreshToken(refreshTokenValue)) {
            throw AuthenticationException.tokenInvalid();
        }

        // 计算 Token Hash
        String tokenHash = hashToken(refreshTokenValue);

        // 查询数据库中的 Refresh Token
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(AuthenticationException::tokenInvalid);

        // 检查是否过期
        if (refreshToken.isExpired()) {
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw AuthenticationException.tokenExpired();
        }

        // 获取用户信息
        Long userId = Objects.requireNonNull(refreshToken.getUserId());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // 删除旧的 Refresh Token
        refreshTokenRepository.deleteByTokenHash(tokenHash);

        // 生成新的 Token
        return generateTokenResponse(user);
    }

    /**
     * 用户登出
     *
     * @param refreshTokenValue 刷新 Token
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
     *
     * @return 安全配置响应
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
     * 处理忘记密码请求
     *
     * <p>实现为非枚举响应（无论账号是否存在都返回成功），防止邮箱枚举攻击。</p>
     * <p>包含限流保护，防止暴力请求。</p>
     *
     * @param request 忘记密码请求
     * @param ipAddress 请求IP地址
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        String email = request.getEmail();
        log.info("[AuthService] Received forgot-password request for email={}, ip={}", email, ipAddress);

        // 1. 查找用户（如果不存在，仍返回成功但记录日志）
        Optional<User> userOpt = userRepository.findByEmail(email);

        // 2. 限流检查（无论用户是否存在都要检查，防止通过响应时间差异进行用户枚举）
        String userIdStr = userOpt.map(u -> u.getId().toString()).orElse(null);
        if (!rateLimiterService.allowPasswordResetRequest(userIdStr, email, ipAddress)) {
            log.warn("[AuthService] Password reset rate limit triggered for email={}, ip={}", email, ipAddress);
            // 返回通用成功响应，不暴露限流触发
            return;
        }

        // 3. 如果用户不存在，静默返回（防止邮箱枚举）
        if (userOpt.isEmpty()) {
            log.info("[AuthService] Password reset requested for non-existent email: {}", email);
            return;
        }

        User user = userOpt.get();

        // 4. 检查用户状态
        if (user.getStatus() == User.UserStatus.DISABLED) {
            log.warn("[AuthService] Password reset requested for disabled user: {}", user.getId());
            return;
        }

        // 5. 清理该用户的旧令牌
        passwordResetTokenRepository.deleteByUserId(user.getId());

        // 6. 生成新的重置令牌
        String rawToken = generateSecureToken();
        String tokenHash = hashToken(rawToken);
        LocalDateTime expiresAt = LocalDateTime.now()
                .plusMinutes(mailProperties.getPasswordResetTokenExpiryMinutes());

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .userId(user.getId())
                .tokenHash(tokenHash)
                .expiresAt(expiresAt)
                .used(false)
                .build();

        passwordResetTokenRepository.save(resetToken);

        // 7. 发送密码重置邮件（异步）
        String resetUrl = mailProperties.buildPasswordResetUrl(rawToken);
        emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), rawToken, resetUrl);

        log.info("[AuthService] Password reset token generated for userId={}, expiresAt={}",
                user.getId(), expiresAt);
    }

    /**
     * 处理密码重置请求
     *
     * @param request 重置密码请求
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        // 1. 验证密码一致性
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.AUTH_PASSWORD_MISMATCH);
        }

        String rawToken = request.getToken();
        log.info("[AuthService] Processing password reset with token length={}", rawToken.length());

        // 2. 计算令牌哈希
        String tokenHash = hashToken(rawToken);

        // 3. 查找令牌
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("无效或已过期的重置令牌"));

        // 4. 验证令牌状态
        if (resetToken.isExpired()) {
            throw new BusinessException("重置令牌已过期，请重新申请");
        }

        if (resetToken.getUsed()) {
            throw new BusinessException("重置令牌已被使用");
        }

        // 5. 查找用户
        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 6. 更新密码
        String newPasswordHash = passwordEncoder.encode(request.getNewPassword());
        userRepository.updatePassword(user.getId(), newPasswordHash);

        // 7. 标记令牌为已使用
        resetToken.markAsUsed();
        passwordResetTokenRepository.save(resetToken);

        // 8. 撤销该用户的所有刷新令牌（强制重新登录）
        refreshTokenRepository.deleteByUserId(user.getId());

        log.info("[AuthService] Password reset successful for userId={}", user.getId());
    }

    /**
     * 生成 Token 响应
     *
     * @param user 用户
     * @return Token 响应
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
        refreshTokenRepository.save(Objects.requireNonNull(tokenEntity));

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
     *
     * @param token 原始令牌
     * @return 令牌哈希
     */
    private String hashToken(String token) {
        return UUID.nameUUIDFromBytes(token.getBytes()).toString();
    }

    /**
     * 生成安全的随机令牌
     *
     * <p>使用 SecureRandom 生成 URL-safe Base64 编码的随机字符串。</p>
     *
     * @return 安全随机令牌
     */
    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[RESET_TOKEN_LENGTH];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
