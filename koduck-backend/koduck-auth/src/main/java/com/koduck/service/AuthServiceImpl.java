package com.koduck.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.auth.ForgotPasswordRequest;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RefreshTokenRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.ResetPasswordRequest;
import com.koduck.dto.auth.SecurityConfigResponse;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.entity.auth.User;
import com.koduck.repository.auth.UserRepository;
import com.koduck.security.AuthUserPrincipal;
import com.koduck.util.JwtUtil;

/**
 * 默认认证服务实现（bootstrap 阶段最小可用实现）。
 */
@Service
public class AuthServiceImpl implements AuthService<AuthUserPrincipal> {

    private static final String DEMO_USERNAME = "demo";
    private static final String DEMO_PASSWORD = "demo123";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Override
    @Transactional
    public TokenResponse<AuthUserPrincipal> login(LoginRequest request, String ipAddress, String userAgent) {
        Objects.requireNonNull(request, "request must not be null");
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        String password = request.getPassword() == null ? "" : request.getPassword();

        if (DEMO_USERNAME.equals(username) && DEMO_PASSWORD.equals(password)) {
            User demoUser = userRepository.findByUsername(DEMO_USERNAME)
                    .or(() -> userRepository.findByEmail("demo@koduck.local"))
                    .orElseGet(() -> userRepository.save(User.builder()
                            .username(DEMO_USERNAME)
                            .email("demo@koduck.local")
                            .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                            .nickname("Demo User")
                            .status(User.UserStatus.ACTIVE)
                            .build()));
            AuthUserPrincipal demoPrincipal = AuthUserPrincipal.from(demoUser, List.of("ROLE_USER"));
            return buildTokenResponse(demoPrincipal);
        }

        User user = findByUsernameOrEmail(username)
                .orElseThrow(() -> new IllegalArgumentException("用户名或密码错误"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }

        user.setLastLoginAt(LocalDateTime.now());
        user.setLastLoginIp(ipAddress);
        userRepository.save(user);

        AuthUserPrincipal principal = AuthUserPrincipal.from(user, List.of("ROLE_USER"));
        return buildTokenResponse(principal);
    }

    @Override
    @Transactional
    public TokenResponse<AuthUserPrincipal> register(RegisterRequest request) {
        Objects.requireNonNull(request, "request must not be null");

        if (!Objects.equals(request.getPassword(), request.getConfirmPassword())) {
            throw new IllegalArgumentException("两次输入的密码不一致");
        }

        String username = normalize(request.getUsername());
        String email = normalize(request.getEmail()).toLowerCase(Locale.ROOT);
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("用户名已被使用");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("邮箱已被使用");
        }

        User user = User.builder()
                .username(username)
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .nickname(normalizeNullable(request.getNickname()))
                .status(User.UserStatus.ACTIVE)
                .build();

        User saved = userRepository.save(user);
        AuthUserPrincipal principal = AuthUserPrincipal.from(saved, List.of("ROLE_USER"));
        return buildTokenResponse(principal);
    }

    @Override
    public TokenResponse<AuthUserPrincipal> refreshToken(RefreshTokenRequest request) {
        Objects.requireNonNull(request, "request must not be null");
        String refreshToken = request.getRefreshToken();
        if (!jwtUtil.validateToken(refreshToken) || !jwtUtil.isRefreshToken(refreshToken)) {
            throw new IllegalArgumentException("无效的刷新令牌");
        }

        Long userId = jwtUtil.getUserIdFromToken(refreshToken);
        Optional<User> existing = userRepository.findById(userId);
        AuthUserPrincipal principal = existing
                .map(user -> AuthUserPrincipal.from(user, List.of("ROLE_USER")))
                .orElseGet(() -> AuthUserPrincipal.builder()
                        .id(userId)
                        .username(DEMO_USERNAME)
                        .email("demo@koduck.local")
                        .nickname("Demo User")
                        .status(AuthUserPrincipal.UserStatus.ACTIVE)
                        .authorities(List.of())
                        .enabled(true)
                        .build());
        return buildTokenResponse(principal);
    }

    @Override
    public void logout(String refreshTokenValue) {
        // bootstrap 阶段不做持久化刷新令牌管理。
    }

    @Override
    public SecurityConfigResponse getSecurityConfig() {
        return SecurityConfigResponse.builder()
                .turnstileEnabled(false)
                .turnstileSiteKey("")
                .registrationEnabled(true)
                .oauthGoogleEnabled(false)
                .oauthGithubEnabled(false)
                .build();
    }

    @Override
    public void forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        // bootstrap 阶段占位：返回成功以避免泄露邮箱存在性。
    }

    @Override
    public void resetPassword(ResetPasswordRequest request) {
        // bootstrap 阶段占位实现。
    }

    private TokenResponse<AuthUserPrincipal> buildTokenResponse(AuthUserPrincipal principal) {
        String accessToken = jwtUtil.generateAccessToken(principal.getId(), principal.getUsername(), principal.getEmail());
        String refreshToken = jwtUtil.generateRefreshToken(principal.getId());
        return TokenResponse.<AuthUserPrincipal>builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(86_400L)
                .user(principal)
                .build();
    }

    private Optional<User> findByUsernameOrEmail(String identifier) {
        Optional<User> byUsername = userRepository.findByUsername(identifier);
        if (byUsername.isPresent()) {
            return byUsername;
        }
        return userRepository.findByEmail(identifier);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }

    private String normalizeNullable(String value) {
        String normalized = normalize(value);
        return normalized.isEmpty() ? null : normalized;
    }
}
