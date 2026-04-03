package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AuthenticationException 测试类.
 *
 * @author Koduck Team
 */
@DisplayName("认证异常测试")
class AuthenticationExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructorWithMessage() {
        String message = "认证失败";
        AuthenticationException exception = new AuthenticationException(message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructorWithErrorCode() {
        AuthenticationException exception = new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 ErrorCode 和自定义消息创建异常")
    void constructorWithErrorCodeAndMessage() {
        String message = "用户名或密码不正确";
        AuthenticationException exception = new AuthenticationException(
                ErrorCode.AUTH_INVALID_CREDENTIALS, message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
    }

    @Test
    @DisplayName("使用 invalidCredentials 静态方法")
    void invalidCredentialsShouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.invalidCredentials();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 tokenExpired 静态方法")
    void tokenExpiredShouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.tokenExpired();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_TOKEN_EXPIRED.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.AUTH_TOKEN_EXPIRED.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 tokenInvalid 静态方法")
    void tokenInvalidShouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.tokenInvalid();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 accountDisabled 静态方法")
    void accountDisabledShouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.accountDisabled();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_ACCOUNT_DISABLED.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.AUTH_ACCOUNT_DISABLED.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 accountLocked 静态方法")
    void accountLockedShouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.accountLocked();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_ACCOUNT_LOCKED.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.AUTH_ACCOUNT_LOCKED.getDefaultMessage());
    }
}
