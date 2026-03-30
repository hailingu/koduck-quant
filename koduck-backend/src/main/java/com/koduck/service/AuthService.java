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
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * 
 *
 * <p>Token </p>
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
    private final JdbcTemplate jdbcTemplate;

    private static final int DEFAULT_ROLE_ID = 2; // USER 

    /**
     * （，）
     */
    private static final List<String> RESERVED_USERNAMES = List.of(
            "admin", "administrator", "root", "system", "test", "guest", "demo"
    );

    /**
     * （URL-safe Base64）
     */
    private static final int RESET_TOKEN_LENGTH = 32;
    private static final int MAX_REFRESH_TOKENS_PER_USER = 2;
    private volatile Boolean userRolesTableExists;

    /**
     * 
     *
     * @param request    
     * @param ipAddress  IP
     * @param userAgent  
     * @return Token 
     */
    @Transactional
    public TokenResponse login(LoginRequest request, String ipAddress, String userAgent) {
        // （）
        User user = userRepository.findByUsername(request.getUsername())
                .orElseGet(() -> userRepository.findByEmail(request.getUsername())
                        .orElseThrow(AuthenticationException::invalidCredentials));

        // 
        if (user.getStatus() == User.UserStatus.DISABLED) {
            throw AuthenticationException.accountDisabled();
        }

        // 
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw AuthenticationException.invalidCredentials();
        }

        // 
        userRepository.updateLastLogin(user.getId(), LocalDateTime.now(), ipAddress);

        //  Token
        return generateTokenResponse(user);
    }

    /**
     * 
     *
     * @param request 
     * @return Token 
     */
    @Transactional
    public TokenResponse register(RegisterRequest request) {
        // （）
        if (RESERVED_USERNAMES.contains(request.getUsername().toLowerCase())) {
            throw new BusinessException(ErrorCode.USER_RESERVED_USERNAME);
        }

        // 
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);
        }

        // 
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);
        }

        // 
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.AUTH_PASSWORD_MISMATCH);
        }

        // 
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname() != null ? request.getNickname() : request.getUsername())
                .status(User.UserStatus.ACTIVE)
                .build();

        @SuppressWarnings("null")
        User savedUser = Objects.requireNonNull(userRepository.save(user));

        // （USER）
        userRoleRepository.insertUserRole(savedUser.getId(), DEFAULT_ROLE_ID);

        //  Token
        return generateTokenResponse(savedUser);
    }

    /**
     *  Token
     *
     * @param request  Token 
     * @return Token 
     */
    @Transactional
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        String refreshTokenValue = request.getRefreshToken();

        //  Refresh Token 
        if (!jwtUtil.validateToken(refreshTokenValue) || !jwtUtil.isRefreshToken(refreshTokenValue)) {
            throw AuthenticationException.tokenInvalid();
        }

        //  Token Hash
        String tokenHash = hashToken(refreshTokenValue);

        //  Refresh Token
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(AuthenticationException::tokenInvalid);

        // 
        if (refreshToken.isExpired()) {
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw AuthenticationException.tokenExpired();
        }

        // 
        Long userId = Objects.requireNonNull(refreshToken.getUserId());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        //  Refresh Token
        refreshTokenRepository.deleteByTokenHash(tokenHash);

        //  Token
        return generateTokenResponse(user);
    }

    /**
     * 
     *
     * @param refreshTokenValue  Token
     */
    @Transactional
    public void logout(String refreshTokenValue) {
        if (refreshTokenValue != null) {
            String tokenHash = hashToken(refreshTokenValue);
            refreshTokenRepository.deleteByTokenHash(tokenHash);
        }
    }

    /**
     * 
     *
     * @return 
     */
    public SecurityConfigResponse getSecurityConfig() {
        return SecurityConfigResponse.builder()
                .turnstileEnabled(false)  // 
                .turnstileSiteKey("")
                .registrationEnabled(true)
                .oauthGoogleEnabled(false)
                .oauthGithubEnabled(false)
                .build();
    }

    /**
     * 
     *
     * <p>（），</p>
     * <p>，</p>
     *
     * @param request 
     * @param ipAddress IP
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        String email = request.getEmail();
        log.info("[AuthService] Received forgot-password request for email={}, ip={}", email, ipAddress);

        // 1. （，）
        Optional<User> userOpt = userRepository.findByEmail(email);

        // 2. （，）
        String userIdStr = userOpt.map(u -> u.getId().toString()).orElse(null);
        if (!rateLimiterService.allowPasswordResetRequest(userIdStr, email, ipAddress)) {
            log.warn("[AuthService] Password reset rate limit triggered for email={}, ip={}", email, ipAddress);
            // ，
            return;
        }

        // 3. ，（）
        if (userOpt.isEmpty()) {
            log.info("[AuthService] Password reset requested for non-existent email: {}", email);
            return;
        }

        User user = userOpt.get();

        // 4. 
        if (user.getStatus() == User.UserStatus.DISABLED) {
            log.warn("[AuthService] Password reset requested for disabled user: {}", user.getId());
            return;
        }

        // 5. 
        passwordResetTokenRepository.deleteByUserId(user.getId());

        // 6. 
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

        // 7. （）
        String resetUrl = mailProperties.buildPasswordResetUrl(rawToken);
        emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), rawToken, resetUrl);

        log.info("[AuthService] Password reset token generated for userId={}, expiresAt={}",
                user.getId(), expiresAt);
    }

    /**
     * 
     *
     * @param request 
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        // 1. 
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.AUTH_PASSWORD_MISMATCH);
        }

        String rawToken = request.getToken();
        log.info("[AuthService] Processing password reset with token length={}", rawToken.length());

        // 2. 
        String tokenHash = hashToken(rawToken);

        // 3. 
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("无效或已过期的重置令牌"));

        // 4. 
        if (resetToken.isExpired()) {
            throw new BusinessException("重置令牌已过期，请重新申请");
        }

        if (resetToken.getUsed()) {
            throw new BusinessException("重置令牌已被使用");
        }

        // 5. 
        Long userId = Objects.requireNonNull(resetToken.getUserId(), "resetToken.userId must not be null");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("用户不存在"));

        // 6. 
        String newPasswordHash = passwordEncoder.encode(request.getNewPassword());
        userRepository.updatePassword(user.getId(), newPasswordHash);

        // 7. 
        resetToken.markAsUsed();
        passwordResetTokenRepository.save(resetToken);

        // 8. （）
        refreshTokenRepository.deleteByUserId(user.getId());

        log.info("[AuthService] Password reset successful for userId={}", user.getId());
    }

    /**
     *  Token 
     *
     * @param user 
     * @return Token 
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

        //  Access Token
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), user.getEmail());

        //  Refresh Token
        String refreshToken = jwtUtil.generateRefreshToken(user.getId());

        //  Refresh Token（每个用户最多保留 MAX_REFRESH_TOKENS_PER_USER 条）
        upsertRefreshTokenWithLimit(user.getId(), hashToken(refreshToken));

        //  UserInfo
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
                .expiresIn(86400L) // 24
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
     *  Token  Hash（）
     *
     * @param token 
     * @return 
     */
    private String hashToken(String token) {
        return UUID.nameUUIDFromBytes(token.getBytes()).toString();
    }

    /**
     * 
     *
     * <p> SecureRandom  URL-safe Base64 </p>
     *
     * @return 
     */
    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[RESET_TOKEN_LENGTH];
        random.nextBytes(bytes);
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
