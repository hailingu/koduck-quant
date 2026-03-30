package com.koduck.service.impl;

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
import com.koduck.service.AuthService;
import com.koduck.service.EmailService;
import com.koduck.service.RateLimiterService;
import com.koduck.util.JwtUtil;
import com.koduck.util.ReservedUsernameValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * 认证服务实现类
 *
 * <p>Token 管理、用户认证与密码重置</p>
 *
 * @author Koduck Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

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
    private final JdbcTemplate jdbcTemplate;

    private static final int DEFAULT_ROLE_ID = 2; // USER 角色

    /**
     * 密码重置令牌长度（URL-safe Base64）
     */
    private static final int RESET_TOKEN_LENGTH = 32;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int MAX_REFRESH_TOKENS_PER_USER = 2;
    private volatile Boolean userRolesTableExists;

    @Override
    @Transactional
    public TokenResponse login(LoginRequest request, String ipAddress, String userAgent) {
        // 查找用户（支持用户名或邮箱登录）
        User user = userRepository.findByUsername(request.getUsername())
                .orElseGet(() -> userRepository.findByEmail(request.getUsername())
                        .orElseThrow(AuthenticationException::invalidCredentials));

        // 检查账户状态
        if (user.getStatus() == User.UserStatus.DISABLED) {
            throw AuthenticationException.accountDisabled();
        }

        // 验证密码
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw AuthenticationException.invalidCredentials();
        }

        // 更新最后登录时间
        userRepository.updateLastLogin(user.getId(), LocalDateTime.now(), ipAddress);

        // 生成并返回 Token
        return generateTokenResponse(user);
    }

    @Override
    @Transactional
    public TokenResponse register(RegisterRequest request) {
        // 检查保留用户名（大小写不敏感）
        if (ReservedUsernameValidator.isReserved(request.getUsername())) {
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

        // 检查密码是否匹配
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

        // 生成并返回 Token
        return generateTokenResponse(savedUser);
    }

    @Override
    @Transactional
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        String refreshTokenValue = request.getRefreshToken();

        // 验证 Refresh Token 格式
        if (!jwtUtil.validateToken(refreshTokenValue) || !jwtUtil.isRefreshToken(refreshTokenValue)) {
            throw AuthenticationException.tokenInvalid();
        }

        // 计算 Token Hash
        String tokenHash = hashToken(refreshTokenValue);

        // 查找 Refresh Token
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(AuthenticationException::tokenInvalid);

        // 检查是否过期
        if (refreshToken.isExpired()) {
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw AuthenticationException.tokenExpired();
        }

        // 获取用户
        Long userId = Objects.requireNonNull(refreshToken.getUserId());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // 删除旧的 Refresh Token
        refreshTokenRepository.deleteByTokenHash(tokenHash);

        // 生成新的 Token
        return generateTokenResponse(user);
    }

    @Override
    @Transactional
    public void logout(String refreshTokenValue) {
        if (refreshTokenValue != null) {
            String tokenHash = hashToken(refreshTokenValue);
            refreshTokenRepository.deleteByTokenHash(tokenHash);
        }
    }

    @Override
    public SecurityConfigResponse getSecurityConfig() {
        return SecurityConfigResponse.builder()
                .turnstileEnabled(false)  // 暂未启用
                .turnstileSiteKey("")
                .registrationEnabled(true)
                .oauthGoogleEnabled(false)
                .oauthGithubEnabled(false)
                .build();
    }

    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        String email = request.getEmail();
        log.info("[AuthService] Received forgot-password request for email={}, ip={}", email, ipAddress);

        // 1. 查找用户（先查找，用于限流）
        Optional<User> userOpt = userRepository.findByEmail(email);

        // 2. 限流检查（无论用户是否存在，都进行限流）
        String userIdStr = userOpt.map(u -> u.getId().toString()).orElse(null);
        if (!rateLimiterService.allowPasswordResetRequest(userIdStr, email, ipAddress)) {
            log.warn("[AuthService] Password reset rate limit triggered for email={}, ip={}", email, ipAddress);
            // 触发限流时静默返回，不暴露邮箱是否存在
            return;
        }

        // 3. 用户不存在时静默返回（防止枚举攻击）
        if (userOpt.isEmpty()) {
            log.info("[AuthService] Password reset requested for non-existent email: {}", email);
            return;
        }

        User user = userOpt.get();

        // 4. 检查账户状态
        if (user.getStatus() == User.UserStatus.DISABLED) {
            log.warn("[AuthService] Password reset requested for disabled user: {}", user.getId());
            return;
        }

        // 5. 删除旧的令牌
        passwordResetTokenRepository.deleteByUserId(user.getId());

        // 6. 生成新令牌
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

        passwordResetTokenRepository.save(Objects.requireNonNull(resetToken));

        // 7. 发送邮件（使用原始令牌）
        String resetUrl = mailProperties.buildPasswordResetUrl(rawToken);
        emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), rawToken, resetUrl);

        log.info("[AuthService] Password reset token generated for userId={}, expiresAt={}",
                user.getId(), expiresAt);
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        // 1. 检查密码是否匹配
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

        // 4. 检查令牌状态
        if (resetToken.isExpired()) {
            throw new BusinessException("重置令牌已过期，请重新申请");
        }

        if (Boolean.TRUE.equals(resetToken.getUsed())) {
            throw new BusinessException("重置令牌已被使用");
        }

        // 5. 获取用户
        Long userId = Objects.requireNonNull(resetToken.getUserId(), "resetToken.userId must not be null");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 6. 更新密码
        String newPasswordHash = passwordEncoder.encode(request.getNewPassword());
        userRepository.updatePassword(user.getId(), newPasswordHash);

        // 7. 标记令牌为已使用
        resetToken.markAsUsed();
        passwordResetTokenRepository.save(resetToken);

        // 8. 撤销所有刷新令牌（强制重新登录）
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
        List<String> roleNames;
        if (!hasUserRolesTable()) {
            roleNames = List.of("USER");
        } else {
            try {
                roleNames = roleRepository.findRoleNamesByUserId(user.getId());
                if (roleNames == null || roleNames.isEmpty()) {
                    roleNames = List.of("USER");
                }
            } catch (DataAccessException ex) {
                log.warn("Failed to load roles for userId={}, fallback to default USER role: {}",
                        user.getId(), ex.getMessage());
                roleNames = List.of("USER");
            }
        }

        if (roleNames == null || roleNames.isEmpty()) {
            roleNames = List.of("USER");
        }

        // 生成 Access Token
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), user.getEmail());

        // 生成 Refresh Token
        String refreshToken = jwtUtil.generateRefreshToken(user.getId());

        // 保存 Refresh Token（每个用户最多保留 MAX_REFRESH_TOKENS_PER_USER 条）
        upsertRefreshTokenWithLimit(user.getId(), hashToken(refreshToken));

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
                .expiresIn(86400L) // 24 小时
                .tokenType("Bearer")
                .user(userInfo)
                .build();
    }

    /**
     * Persist refresh token and enforce per-user token cap.
     *
     * <p>Policy: at most {@value #MAX_REFRESH_TOKENS_PER_USER} active refresh tokens per user.</p>
     */
    private void upsertRefreshTokenWithLimit(Long userId, String tokenHash) {
        LocalDateTime now = LocalDateTime.now();
        refreshTokenRepository.deleteAllExpiredBefore(now);

        long existingCount = refreshTokenRepository.countByUserId(userId);
        if (existingCount >= MAX_REFRESH_TOKENS_PER_USER) {
            int removeCount = (int) (existingCount - (MAX_REFRESH_TOKENS_PER_USER - 1));
            List<RefreshToken> oldestTokens = refreshTokenRepository.findByUserIdOrderByCreatedAtAsc(userId);
            if (!oldestTokens.isEmpty() && removeCount > 0) {
                int toIndex = Math.min(removeCount, oldestTokens.size());
                List<RefreshToken> tokensToDelete = List.copyOf(oldestTokens.subList(0, toIndex));
                refreshTokenRepository.deleteAllInBatch(Objects.requireNonNull(tokensToDelete));
            }
        }

        RefreshToken tokenEntity = RefreshToken.builder()
                .userId(userId)
                .tokenHash(tokenHash)
                .expiresAt(now.plusDays(7))
                .build();
        refreshTokenRepository.save(Objects.requireNonNull(tokenEntity));
    }

    /**
     * 计算 Token 的 Hash（用于存储）
     *
     * @param token 原始 Token
     * @return Token Hash
     */
    private String hashToken(String token) {
        return UUID.nameUUIDFromBytes(token.getBytes(StandardCharsets.UTF_8)).toString();
    }

    /**
     * 生成安全随机令牌
     *
     * <p>使用 SecureRandom 生成 URL-safe Base64 编码的字符串</p>
     *
     * @return 安全随机令牌
     */
    private String generateSecureToken() {
        byte[] bytes = new byte[RESET_TOKEN_LENGTH];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private boolean hasUserRolesTable() {
        Boolean cached = userRolesTableExists;
        if (cached != null) {
            return cached;
        }

        boolean exists;
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables " +
                            "WHERE table_schema = 'public' AND table_name = 'user_roles'",
                    Integer.class
            );
            exists = count != null && count > 0;
        } catch (DataAccessException ex) {
            log.warn("Failed to check user_roles table existence, assume missing: {}", ex.getMessage());
            exists = false;
        }

        userRolesTableExists = exists;
        return exists;
    }
}
