package com.koduck.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.koduck.config.properties.MailProperties;
import com.koduck.dto.auth.ForgotPasswordRequest;
import com.koduck.dto.auth.ResetPasswordRequest;
import com.koduck.entity.PasswordResetToken;
import com.koduck.entity.User;
import com.koduck.exception.BusinessException;
import com.koduck.exception.ErrorCode;
import com.koduck.service.impl.AuthServiceImpl;
import com.koduck.repository.PasswordResetTokenRepository;
import com.koduck.repository.RefreshTokenRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.repository.UserRoleRepository;
import com.koduck.service.support.DefaultUserRoleResolver;
import com.koduck.service.support.UserRolesTableChecker;
import com.koduck.util.JwtUtil;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for password reset functionality in {@link AuthService}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AuthServicePasswordResetTest {

    /** Mock user repository. */
    @Mock
    private UserRepository userRepository;

    /** Mock role repository. */
    @Mock
    private RoleRepository roleRepository;

    /** Mock refresh token repository. */
    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    /** Mock user role repository. */
    @Mock
    private UserRoleRepository userRoleRepository;

    /** Mock password reset token repository. */
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    /** Mock JWT utility. */
    @Mock
    private JwtUtil jwtUtil;

    /** Mock password encoder. */
    @Mock
    private PasswordEncoder passwordEncoder;

    /** Mock email service. */
    @Mock
    private EmailService emailService;

    /** Mock rate limiter service. */
    @Mock
    private RateLimiterService rateLimiterService;

    /** Mock mail properties. */
    @Mock
    private MailProperties mailProperties;

    /** Mock user roles table checker. */
    @Mock
    private UserRolesTableChecker userRolesTableChecker;

    /** Mock default user role resolver. */
    @Mock
    private DefaultUserRoleResolver defaultUserRoleResolver;

    /** Auth service implementation under test. */
    private AuthServiceImpl authService;

    /** Test IP address. */
    private static final String TEST_IP = "192.168.1.1";

    /** Test email address. */
    private static final String TEST_EMAIL = "user@example.com";

    /** Test username. */
    private static final String TEST_USERNAME = "testuser";

    /** Test user ID. */
    private static final Long TEST_USER_ID = 1L;

    /** Password reset token expiry minutes. */
    private static final int PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 30;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(
                userRepository,
                roleRepository,
                refreshTokenRepository,
                userRoleRepository,
                passwordResetTokenRepository,
                jwtUtil,
                passwordEncoder,
                emailService,
                rateLimiterService,
                mailProperties,
                userRolesTableChecker,
                defaultUserRoleResolver
        );
    }

    // ========== Forgot Password Tests ==========

    @Test
    @DisplayName("shouldSendResetEmailWhenUserExistsAndRateLimitNotExceeded")
    void shouldSendResetEmailWhenUserExists() {
        // Given
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(TEST_EMAIL);

        User user = User.builder()
                .id(TEST_USER_ID)
                .email(TEST_EMAIL)
                .username(TEST_USERNAME)
                .status(User.UserStatus.ACTIVE)
                .build();

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(rateLimiterService.allowPasswordResetRequest(any(), any(), any())).thenReturn(true);
        when(mailProperties.getPasswordResetTokenExpiryMinutes())
                .thenReturn(PASSWORD_RESET_TOKEN_EXPIRY_MINUTES);
        when(mailProperties.buildPasswordResetUrl(any())).thenReturn("http://localhost/reset?token=test");

        // When
        authService.forgotPassword(request, TEST_IP);

        // Then
        verify(passwordResetTokenRepository).deleteByUserId(TEST_USER_ID);
        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
        verify(emailService).sendPasswordResetEmail(eq(TEST_EMAIL), eq(TEST_USERNAME), any(), any());
    }

    @Test
    @DisplayName("shouldReturnSilentlyWhenUserDoesNotExist")
    void shouldReturnSilentlyWhenUserNotFound() {
        // Given
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("nonexistent@example.com");

        when(userRepository.findByEmail("nonexistent@example.com")).thenReturn(Optional.empty());
        when(rateLimiterService.allowPasswordResetRequest(isNull(), any(), any())).thenReturn(true);

        // When
        authService.forgotPassword(request, TEST_IP);

        // Then
        verify(passwordResetTokenRepository, never()).save(any());
        verify(emailService, never()).sendPasswordResetEmail(any(), any(), any(), any());
    }

    @Test
    @DisplayName("shouldReturnSilentlyWhenUserIsDisabled")
    void shouldReturnSilentlyWhenUserDisabled() {
        // Given
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(TEST_EMAIL);

        User disabledUser = User.builder()
                .id(TEST_USER_ID)
                .email(TEST_EMAIL)
                .username(TEST_USERNAME)
                .status(User.UserStatus.DISABLED)
                .build();

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(disabledUser));
        when(rateLimiterService.allowPasswordResetRequest(any(), any(), any())).thenReturn(true);

        // When
        authService.forgotPassword(request, TEST_IP);

        // Then
        verify(passwordResetTokenRepository, never()).save(any());
        verify(emailService, never()).sendPasswordResetEmail(any(), any(), any(), any());
    }

    @Test
    @DisplayName("shouldReturnSilentlyWhenRateLimitExceeded")
    void shouldReturnSilentlyWhenRateLimitExceeded() {
        // Given
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(TEST_EMAIL);

        User user = User.builder()
                .id(TEST_USER_ID)
                .email(TEST_EMAIL)
                .username(TEST_USERNAME)
                .status(User.UserStatus.ACTIVE)
                .build();

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(rateLimiterService.allowPasswordResetRequest(any(), any(), any())).thenReturn(false);

        // When
        authService.forgotPassword(request, TEST_IP);

        // Then
        verify(passwordResetTokenRepository, never()).save(any());
        verify(emailService, never()).sendPasswordResetEmail(any(), any(), any(), any());
    }

    // ========== Reset Password Tests ==========

    @Test
    @DisplayName("shouldResetPasswordWhenTokenIsValid")
    void shouldResetPasswordWhenTokenValid() {
        // Given
        String rawToken = "valid-token-12345";
        String tokenHash = hashTokenForTest(rawToken);
        String newPassword = "newPassword123";
        String encodedPassword = "encodedPassword123";

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(rawToken);
        request.setNewPassword(newPassword);
        request.setConfirmPassword(newPassword);

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .id(1L)
                .userId(TEST_USER_ID)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(false)
                .build();

        User user = User.builder()
                .id(TEST_USER_ID)
                .email(TEST_EMAIL)
                .username(TEST_USERNAME)
                .build();

        when(passwordResetTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(resetToken));
        when(userRepository.findById(TEST_USER_ID)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(newPassword)).thenReturn(encodedPassword);

        // When
        authService.resetPassword(request);

        // Then
        verify(userRepository).updatePassword(TEST_USER_ID, encodedPassword);
        verify(passwordResetTokenRepository).save(argThat(t -> t.getUsed().equals(true)));
        verify(refreshTokenRepository).deleteByUserId(TEST_USER_ID);
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenPasswordsDoNotMatch")
    void shouldThrowExceptionWhenPasswordsMismatch() {
        // Given
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("token");
        request.setNewPassword("password1");
        request.setConfirmPassword("password2");

        // When & Then
        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(BusinessException.class)
                .hasMessage("密码不匹配");

        verifyNoInteractions(passwordResetTokenRepository);
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenTokenNotFound")
    void shouldThrowExceptionWhenTokenNotFound() {
        // Given
        String rawToken = "invalid-token";
        String tokenHash = hashTokenForTest(rawToken);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(rawToken);
        request.setNewPassword("newPassword123");
        request.setConfirmPassword("newPassword123");

        when(passwordResetTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(BusinessException.class)
                .hasMessage(ErrorCode.AUTH_TOKEN_INVALID.getDefaultMessage());
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenTokenExpired")
    void shouldThrowExceptionWhenTokenExpired() {
        // Given
        String rawToken = "expired-token";
        String tokenHash = hashTokenForTest(rawToken);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(rawToken);
        request.setNewPassword("newPassword123");
        request.setConfirmPassword("newPassword123");

        PasswordResetToken expiredToken = PasswordResetToken.builder()
                .id(1L)
                .userId(TEST_USER_ID)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().minusHours(1))
                .used(false)
                .build();

        when(passwordResetTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(expiredToken));

        // When & Then
        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(BusinessException.class)
                .hasMessage("重置令牌已过期，请重新申请");
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenTokenAlreadyUsed")
    void shouldThrowExceptionWhenTokenAlreadyUsed() {
        // Given
        String rawToken = "used-token";
        String tokenHash = hashTokenForTest(rawToken);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(rawToken);
        request.setNewPassword("newPassword123");
        request.setConfirmPassword("newPassword123");

        PasswordResetToken usedToken = PasswordResetToken.builder()
                .id(1L)
                .userId(TEST_USER_ID)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(true)
                .usedAt(LocalDateTime.now())
                .build();

        when(passwordResetTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(usedToken));

        // When & Then
        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(BusinessException.class)
                .hasMessage("重置令牌已被使用");
    }

    @Test
    @DisplayName("shouldClearOldTokensBeforeCreatingNewOne")
    void shouldClearOldTokensBeforeCreatingNew() {
        // Given
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(TEST_EMAIL);

        User user = User.builder()
                .id(TEST_USER_ID)
                .email(TEST_EMAIL)
                .username(TEST_USERNAME)
                .status(User.UserStatus.ACTIVE)
                .build();

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(rateLimiterService.allowPasswordResetRequest(any(), any(), any())).thenReturn(true);
        when(mailProperties.getPasswordResetTokenExpiryMinutes())
                .thenReturn(PASSWORD_RESET_TOKEN_EXPIRY_MINUTES);
        when(mailProperties.buildPasswordResetUrl(any())).thenReturn("http://localhost/reset?token=test");

        // When
        authService.forgotPassword(request, TEST_IP);

        // Then
        verify(passwordResetTokenRepository).deleteByUserId(TEST_USER_ID);
        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
    }

    private String hashTokenForTest(String token) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            byte[] hash = messageDigest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        }
        catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
