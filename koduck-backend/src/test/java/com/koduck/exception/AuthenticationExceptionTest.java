package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AuthenticationException 
 */
@DisplayName("认证异常测试")
class AuthenticationExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructor_withMessage() {
        AuthenticationException exception = new AuthenticationException("认证失败");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("认证失败");
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructor_withErrorCode() {
        AuthenticationException exception = new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 ErrorCode 和自定义消息创建异常")
    void constructor_withErrorCodeAndMessage() {
        AuthenticationException exception = new AuthenticationException(
                ErrorCode.AUTH_INVALID_CREDENTIALS, "用户名或密码不正确");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getCode());
        assertThat(exception.getMessage()).isEqualTo("用户名或密码不正确");
    }

    @Test
    @DisplayName("使用 invalidCredentials 静态方法")
    void invalidCredentials_shouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.invalidCredentials();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 tokenExpired 静态方法")
    void tokenExpired_shouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.tokenExpired();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_TOKEN_EXPIRED.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.AUTH_TOKEN_EXPIRED.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 tokenInvalid 静态方法")
    void tokenInvalid_shouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.tokenInvalid();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.AUTH_TOKEN_INVALID.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 accountDisabled 静态方法")
    void accountDisabled_shouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.accountDisabled();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_ACCOUNT_DISABLED.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.AUTH_ACCOUNT_DISABLED.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 accountLocked 静态方法")
    void accountLocked_shouldCreateCorrectException() {
        AuthenticationException exception = AuthenticationException.accountLocked();

        assertThat(exception.getCode()).isEqualTo(ErrorCode.AUTH_ACCOUNT_LOCKED.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.AUTH_ACCOUNT_LOCKED.getDefaultMessage());
    }
}
